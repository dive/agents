#!/usr/bin/env python3
"""Manage global AGENTS.md links for coding tools."""

from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class LinkTarget:
    tool: str
    relative_dest: str  # relative to home


@dataclass(frozen=True)
class GlobalFallbackTool:
    tool: str
    legacy_relative_dest: Optional[str] = None


@dataclass(frozen=True)
class PiExtensionPackage:
    name: str
    path: Path


# Direct links managed by this script.
# Sources (2026-02-15):
# - Codex: https://developers.openai.com/codex/guides/agents-md.md
# - Claude: https://code.claude.com/docs/en/memory.md
# - OpenCode: https://opencode.ai/docs/rules.md
# - Pi: npm readme / docs
# - Amp: https://ampcode.com/manual/AGENTS.md.md
DIRECT_LINK_TARGETS: list[LinkTarget] = [
    LinkTarget("Codex CLI", ".codex/AGENTS.md"),
    LinkTarget("Claude Code", ".claude/CLAUDE.md"),
    LinkTarget("OpenCode", ".config/opencode/AGENTS.md"),
    LinkTarget("Pi (pi-mono)", ".pi/agent/AGENTS.md"),
    LinkTarget("Universal ~/.config fallback", ".config/AGENTS.md"),
]

# Tools that can consume ~/.config/AGENTS.md directly.
# We avoid creating dedicated per-tool links for these.
GLOBAL_FALLBACK_TOOLS: list[GlobalFallbackTool] = [
    GlobalFallbackTool("Amp", ".config/amp/AGENTS.md"),
]


@dataclass(frozen=True)
class Ctx:
    repo_root: Path
    home: Path

    @property
    def source(self) -> Path:
        return self.repo_root / "global" / "AGENTS.md"

    @property
    def global_fallback_dest(self) -> Path:
        return self.home / ".config" / "AGENTS.md"

    @property
    def global_pi_settings(self) -> Path:
        return self.home / ".pi" / "agent" / "settings.json"

    @property
    def project_pi_settings(self) -> Path:
        return self.repo_root / ".pi" / "settings.json"

    @property
    def pi_extensions_root(self) -> Path:
        return self.repo_root / "pi-extensions" / "packages"

    def fmt(self, path: Path) -> str:
        try:
            return f"<REPO>/{path.relative_to(self.repo_root)}"
        except ValueError:
            pass
        try:
            return f"~/{path.relative_to(self.home)}"
        except ValueError:
            return str(path)


@dataclass
class HealthReport:
    healthy: list[tuple[LinkTarget, Path]] = field(default_factory=list)
    broken: list[tuple[LinkTarget, Path, object]] = field(default_factory=list)
    mismatch: list[tuple[LinkTarget, Path, object]] = field(default_factory=list)
    conflict: list[tuple[LinkTarget, Path]] = field(default_factory=list)
    missing: list[tuple[LinkTarget, Path]] = field(default_factory=list)
    fallback_ok: list[tuple[GlobalFallbackTool, Path]] = field(default_factory=list)
    fallback_issue: list[tuple[GlobalFallbackTool, str]] = field(default_factory=list)
    legacy_present: list[tuple[GlobalFallbackTool, Path, str]] = field(default_factory=list)


@dataclass
class PiExtensionsHealthReport:
    packages: list[PiExtensionPackage] = field(default_factory=list)
    global_installed: dict[str, str] = field(default_factory=dict)
    local_installed: dict[str, str] = field(default_factory=dict)
    global_missing: list[str] = field(default_factory=list)
    local_missing: list[str] = field(default_factory=list)
    global_settings_path: Optional[Path] = None
    local_settings_path: Optional[Path] = None
    global_settings_error: Optional[str] = None
    local_settings_error: Optional[str] = None


def get_ctx() -> Ctx:
    return Ctx(repo_root=Path(__file__).parent.resolve(), home=Path.home())


def resolve_symlink_target(link_path: Path) -> Optional[Path]:
    if not link_path.is_symlink():
        return None
    target = link_path.readlink()
    if target.is_absolute():
        return target.resolve(strict=False)
    return (link_path.parent / target).resolve(strict=False)


def symlink_points_to(dest: Path, src: Path) -> bool:
    if not dest.is_symlink():
        return False
    try:
        target = resolve_symlink_target(dest)
    except OSError:
        return False
    if target is None:
        return False
    return target == src.resolve(strict=False)


def ensure_symlink(src: Path, dest: Path, ctx: Ctx, replace_symlinks: bool) -> bool:
    if dest.is_symlink():
        if symlink_points_to(dest, src):
            print(f"Info: skipping existing correct link at {ctx.fmt(dest)}")
            return True

        if not replace_symlinks:
            print(f"Error: refusing to replace {ctx.fmt(dest)} (symlink points elsewhere)")
            return False

        dest.unlink()
        print(f"Info: replaced stale symlink at {ctx.fmt(dest)}")

    elif dest.exists():
        print(f"Error: refusing to replace existing path at {ctx.fmt(dest)}")
        return False

    dest.parent.mkdir(parents=True, exist_ok=True)
    os.symlink(src, dest)
    print(f"Linked {ctx.fmt(src)} -> {ctx.fmt(dest)}")
    return True


def iter_destinations(ctx: Ctx) -> list[tuple[LinkTarget, Path]]:
    return [(target, ctx.home / target.relative_dest) for target in DIRECT_LINK_TARGETS]


def _cleanup_legacy_fallback_links(ctx: Ctx) -> bool:
    """Remove managed legacy per-tool links for fallback tools when safe."""
    ok = True
    for tool in GLOBAL_FALLBACK_TOOLS:
        if not tool.legacy_relative_dest:
            continue
        legacy = ctx.home / tool.legacy_relative_dest

        if not legacy.exists() and not legacy.is_symlink():
            continue

        if legacy.is_symlink() and symlink_points_to(legacy, ctx.source):
            try:
                legacy.unlink()
                print(
                    f"Info: removed dedicated link {ctx.fmt(legacy)}; "
                    f"{tool.tool} uses {ctx.fmt(ctx.global_fallback_dest)}"
                )
            except OSError as err:
                print(f"Error: failed removing {ctx.fmt(legacy)}: {err}")
                ok = False
            continue

        if legacy.is_symlink():
            try:
                target = legacy.readlink()
            except OSError:
                target = "???"
            print(
                f"Info: leaving existing dedicated link for {tool.tool} at "
                f"{ctx.fmt(legacy)} -> {target}"
            )
        else:
            print(
                f"Info: leaving existing dedicated path for {tool.tool} at "
                f"{ctx.fmt(legacy)} (not a symlink)"
            )

    return ok


def _log_global_fallback_tools(ctx: Ctx) -> bool:
    ok = True
    for tool in GLOBAL_FALLBACK_TOOLS:
        if symlink_points_to(ctx.global_fallback_dest, ctx.source):
            print(
                f"Info: {tool.tool} uses global fallback at "
                f"{ctx.fmt(ctx.global_fallback_dest)}"
            )
            continue

        if ctx.global_fallback_dest.is_symlink():
            try:
                target = ctx.global_fallback_dest.readlink()
            except OSError:
                target = "???"
            print(
                f"Warning: {tool.tool} expects {ctx.fmt(ctx.global_fallback_dest)}, "
                f"but it points to {target}"
            )
        elif ctx.global_fallback_dest.exists():
            print(
                f"Warning: {tool.tool} expects {ctx.fmt(ctx.global_fallback_dest)}, "
                "but it is not linked to this repo source"
            )
        else:
            print(
                f"Warning: {tool.tool} expects {ctx.fmt(ctx.global_fallback_dest)}, "
                "but it is missing"
            )
        ok = False

    return ok


def link(replace_symlinks: bool) -> int:
    ctx = get_ctx()
    print(f"Linking AGENTS.md from {ctx.fmt(ctx.source)}")

    if not ctx.source.exists():
        print(f"Error: source not found at {ctx.fmt(ctx.source)}")
        return 1

    ok = True
    for target, dest in iter_destinations(ctx):
        print(f"\n[{target.tool}]")
        if not ensure_symlink(ctx.source, dest, ctx, replace_symlinks=replace_symlinks):
            ok = False

    print("\n[Global fallback tools]")
    if not _cleanup_legacy_fallback_links(ctx):
        ok = False
    if not _log_global_fallback_tools(ctx):
        ok = False

    if not ok:
        print("\n❌ Link completed with errors. Resolve conflicts and re-run.")
        return 1

    print("\n✅ Link completed.")
    return 0


def collect_health(ctx: Ctx) -> HealthReport:
    report = HealthReport()
    src = ctx.source.resolve(strict=False)

    for target, dest in iter_destinations(ctx):
        if dest.is_symlink():
            if not dest.exists():
                try:
                    report.broken.append((target, dest, dest.readlink()))
                except OSError:
                    report.broken.append((target, dest, "???"))
                continue

            if symlink_points_to(dest, src):
                report.healthy.append((target, dest))
            else:
                try:
                    report.mismatch.append((target, dest, dest.readlink()))
                except OSError:
                    report.mismatch.append((target, dest, "???"))
            continue

        if dest.exists():
            report.conflict.append((target, dest))
        else:
            report.missing.append((target, dest))

    for tool in GLOBAL_FALLBACK_TOOLS:
        gf = ctx.global_fallback_dest
        if symlink_points_to(gf, src):
            report.fallback_ok.append((tool, gf))
        elif gf.is_symlink():
            try:
                target = gf.readlink()
            except OSError:
                target = "???"
            report.fallback_issue.append((tool, f"{ctx.fmt(gf)} points to {target}"))
        elif gf.exists():
            report.fallback_issue.append(
                (tool, f"{ctx.fmt(gf)} exists but is not linked to {ctx.fmt(ctx.source)}")
            )
        else:
            report.fallback_issue.append((tool, f"{ctx.fmt(gf)} is missing"))

        if tool.legacy_relative_dest:
            legacy = ctx.home / tool.legacy_relative_dest
            if legacy.exists() or legacy.is_symlink():
                if legacy.is_symlink() and symlink_points_to(legacy, src):
                    detail = "dedicated link still points to repo source"
                elif legacy.is_symlink():
                    try:
                        detail = f"dedicated link -> {legacy.readlink()}"
                    except OSError:
                        detail = "dedicated broken symlink"
                else:
                    detail = "dedicated path exists (not a symlink)"
                report.legacy_present.append((tool, legacy, detail))

    return report


def print_health(report: HealthReport, ctx: Ctx) -> None:
    print("AGENTS.md link health:")

    if report.healthy:
        print(f"\n✅ Healthy ({len(report.healthy)}):")
        for target, dest in report.healthy:
            print(f"  {target.tool}: {ctx.fmt(dest)}")

    if report.broken:
        print(f"\n❌ Broken ({len(report.broken)}):")
        for target, dest, link_target in report.broken:
            print(f"  {target.tool}: {ctx.fmt(dest)} -> {link_target}")

    if report.mismatch:
        print(f"\n⚠️  Mismatch ({len(report.mismatch)}):")
        for target, dest, link_target in report.mismatch:
            print(f"  {target.tool}: {ctx.fmt(dest)} -> {link_target}")

    if report.conflict:
        print(f"\n⛔ Conflict ({len(report.conflict)}):")
        for target, dest in report.conflict:
            print(f"  {target.tool}: {ctx.fmt(dest)} (exists but not symlink)")

    if report.missing:
        print(f"\n⚪ Missing ({len(report.missing)}):")
        for target, dest in report.missing:
            print(f"  {target.tool}: {ctx.fmt(dest)}")

    if report.fallback_ok:
        print(f"\n✅ Global fallback tools ({len(report.fallback_ok)}):")
        for tool, dest in report.fallback_ok:
            print(f"  {tool.tool}: using {ctx.fmt(dest)}")

    if report.fallback_issue:
        print(f"\n⚠️  Global fallback issues ({len(report.fallback_issue)}):")
        for tool, issue in report.fallback_issue:
            print(f"  {tool.tool}: {issue}")

    if report.legacy_present:
        print(f"\nℹ️  Dedicated fallback paths present ({len(report.legacy_present)}):")
        for tool, path, detail in report.legacy_present:
            print(f"  {tool.tool}: {ctx.fmt(path)} ({detail})")

    if not (
        report.broken
        or report.mismatch
        or report.conflict
        or report.missing
        or report.fallback_issue
    ):
        print("\nAll configured links are healthy.")


def health() -> int:
    ctx = get_ctx()
    report = collect_health(ctx)
    print_health(report, ctx)
    return 0


def list_targets() -> int:
    ctx = get_ctx()
    print(f"Source: {ctx.fmt(ctx.source)}\n")

    print("Direct managed destinations:")
    for target, dest in iter_destinations(ctx):
        print(f"- {target.tool}: {ctx.fmt(dest)}")

    print("\nTools using global fallback (~/.config/AGENTS.md):")
    for tool in GLOBAL_FALLBACK_TOOLS:
        print(f"- {tool.tool}")

    return 0


SUPPORTED_PI_SCOPES = ("global", "local", "both")
_NON_LOCAL_PACKAGE_PREFIXES = ("npm:", "git:", "https://", "http://", "ssh://", "git://")


def discover_pi_extension_packages(ctx: Ctx) -> list[PiExtensionPackage]:
    packages_dir = ctx.pi_extensions_root
    if not packages_dir.exists():
        return []

    packages: list[PiExtensionPackage] = []
    for manifest_path in sorted(packages_dir.glob("*/package.json")):
        package_dir = manifest_path.parent.resolve(strict=False)
        package_name = package_dir.name

        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("name"), str):
                package_name = data["name"]
        except (OSError, json.JSONDecodeError):
            pass

        packages.append(PiExtensionPackage(name=package_name, path=package_dir))

    return packages


def _iter_scopes(scope: str) -> list[str]:
    if scope == "both":
        return ["global", "local"]
    return [scope]


def _collect_package_sources(settings_data: object) -> list[str]:
    if not isinstance(settings_data, dict):
        return []

    raw_packages = settings_data.get("packages")
    if not isinstance(raw_packages, list):
        return []

    sources: list[str] = []
    for entry in raw_packages:
        if isinstance(entry, str):
            sources.append(entry)
            continue
        if isinstance(entry, dict) and isinstance(entry.get("source"), str):
            sources.append(entry["source"])

    return sources


def _resolve_local_source(source: str, settings_path: Path) -> Optional[Path]:
    if source.startswith(_NON_LOCAL_PACKAGE_PREFIXES):
        return None

    source_path = Path(source)
    if not source_path.is_absolute():
        source_path = settings_path.parent / source_path
    return source_path.resolve(strict=False)


def _collect_scope_install_map(settings_path: Path) -> tuple[dict[Path, str], Optional[str]]:
    if not settings_path.exists():
        return {}, None

    try:
        settings_data = json.loads(settings_path.read_text(encoding="utf-8"))
    except OSError as err:
        return {}, f"failed reading {settings_path}: {err}"
    except json.JSONDecodeError as err:
        return {}, f"failed parsing {settings_path}: {err}"

    install_map: dict[Path, str] = {}
    for source in _collect_package_sources(settings_data):
        resolved = _resolve_local_source(source, settings_path)
        if resolved is not None:
            install_map[resolved] = source

    return install_map, None


def collect_pi_extensions_health(ctx: Ctx, scope: str) -> PiExtensionsHealthReport:
    report = PiExtensionsHealthReport(packages=discover_pi_extension_packages(ctx))

    scopes = _iter_scopes(scope)
    if "global" in scopes:
        report.global_settings_path = ctx.global_pi_settings
        global_map, global_error = _collect_scope_install_map(ctx.global_pi_settings)
        report.global_settings_error = global_error
        report.global_installed = {
            pkg.name: global_map[pkg.path.resolve(strict=False)]
            for pkg in report.packages
            if pkg.path.resolve(strict=False) in global_map
        }
        report.global_missing = [
            pkg.name
            for pkg in report.packages
            if pkg.path.resolve(strict=False) not in global_map
        ]

    if "local" in scopes:
        report.local_settings_path = ctx.project_pi_settings
        local_map, local_error = _collect_scope_install_map(ctx.project_pi_settings)
        report.local_settings_error = local_error
        report.local_installed = {
            pkg.name: local_map[pkg.path.resolve(strict=False)]
            for pkg in report.packages
            if pkg.path.resolve(strict=False) in local_map
        }
        report.local_missing = [
            pkg.name
            for pkg in report.packages
            if pkg.path.resolve(strict=False) not in local_map
        ]

    return report


def print_pi_extensions_health(report: PiExtensionsHealthReport, ctx: Ctx, scope: str) -> None:
    print("pi-extensions package health:")

    if not report.packages:
        print(f"\n⚠️  No packages found under {ctx.fmt(ctx.pi_extensions_root)}")
        return

    print(f"\nDiscovered packages ({len(report.packages)}):")
    for pkg in report.packages:
        print(f"  - {pkg.name}: {ctx.fmt(pkg.path)}")

    scopes = _iter_scopes(scope)

    if "global" in scopes:
        settings_path = report.global_settings_path or ctx.global_pi_settings
        print(f"\n[global] settings: {ctx.fmt(settings_path)}")
        if report.global_settings_error:
            print(f"  ❌ {report.global_settings_error}")
        if report.global_installed:
            print(f"  ✅ Installed ({len(report.global_installed)}):")
            for name, source in sorted(report.global_installed.items()):
                print(f"    - {name}: {source}")
        if report.global_missing:
            print(f"  ⚪ Missing ({len(report.global_missing)}):")
            for name in report.global_missing:
                print(f"    - {name}")

    if "local" in scopes:
        settings_path = report.local_settings_path or ctx.project_pi_settings
        print(f"\n[local] settings: {ctx.fmt(settings_path)}")
        if report.local_settings_error:
            print(f"  ❌ {report.local_settings_error}")
        if report.local_installed:
            print(f"  ✅ Installed ({len(report.local_installed)}):")
            for name, source in sorted(report.local_installed.items()):
                print(f"    - {name}: {source}")
        if report.local_missing:
            print(f"  ⚪ Missing ({len(report.local_missing)}):")
            for name in report.local_missing:
                print(f"    - {name}")


def pi_extensions_health(scope: str, strict: bool = False) -> int:
    ctx = get_ctx()
    report = collect_pi_extensions_health(ctx, scope)
    print_pi_extensions_health(report, ctx, scope)

    if not strict:
        return 0

    scopes = _iter_scopes(scope)
    has_error = (
        ("global" in scopes and report.global_settings_error is not None)
        or ("local" in scopes and report.local_settings_error is not None)
    )
    has_missing = (
        ("global" in scopes and bool(report.global_missing))
        or ("local" in scopes and bool(report.local_missing))
    )

    if has_error or has_missing:
        return 1
    return 0


def _resolve_requested_packages(ctx: Ctx, package_names: Optional[list[str]]) -> tuple[list[PiExtensionPackage], Optional[str]]:
    packages = discover_pi_extension_packages(ctx)
    if not packages:
        return [], f"No pi extension packages found under {ctx.fmt(ctx.pi_extensions_root)}"

    if not package_names:
        return packages, None

    by_key: dict[str, PiExtensionPackage] = {}
    for pkg in packages:
        by_key[pkg.name] = pkg
        by_key[pkg.path.name] = pkg

    selected: list[PiExtensionPackage] = []
    unknown: list[str] = []
    for name in package_names:
        pkg = by_key.get(name)
        if pkg is None:
            unknown.append(name)
            continue
        if pkg not in selected:
            selected.append(pkg)

    if unknown:
        options = ", ".join(sorted(pkg.name for pkg in packages))
        return [], f"Unknown package(s): {', '.join(unknown)}. Available: {options}"

    return selected, None


def _run_pi_command(command: list[str], dry_run: bool) -> bool:
    print(f"$ {shlex.join(command)}")
    if dry_run:
        return True

    try:
        result = subprocess.run(command, check=False)
    except OSError as err:
        print(f"Error: failed to execute command: {err}")
        return False

    if result.returncode != 0:
        print(f"Error: command failed with exit code {result.returncode}")
        return False

    return True


def _require_pi_cli() -> bool:
    if shutil.which("pi"):
        return True

    print("Error: `pi` CLI not found in PATH")
    return False


def _scope_install_map(report: PiExtensionsHealthReport, scope: str) -> dict[str, str]:
    if scope == "global":
        return report.global_installed
    return report.local_installed


def _install_or_remove_pi_extensions(
    action: str,
    scope: str,
    package_names: Optional[list[str]],
    dry_run: bool,
) -> int:
    if action not in {"install", "remove"}:
        print(f"Error: unsupported action {action}")
        return 1

    if not _require_pi_cli():
        return 1

    ctx = get_ctx()
    packages, selection_error = _resolve_requested_packages(ctx, package_names)
    if selection_error:
        print(f"Error: {selection_error}")
        return 1

    health_report = collect_pi_extensions_health(ctx, scope)
    scopes = _iter_scopes(scope)

    ok = True
    changed = False

    for scoped in scopes:
        installed_map = _scope_install_map(health_report, scoped)
        for pkg in packages:
            is_installed = pkg.name in installed_map
            if action == "install" and is_installed:
                print(f"Info: [{scoped}] {pkg.name} already installed")
                continue
            if action == "remove" and not is_installed:
                print(f"Info: [{scoped}] {pkg.name} already absent")
                continue

            cmd = ["pi", action]
            if scoped == "local":
                cmd.append("-l")
            cmd.append(str(pkg.path))

            if not _run_pi_command(cmd, dry_run=dry_run):
                ok = False
            else:
                changed = True

    if not ok:
        return 1

    verb = "would update" if dry_run else "updated"
    if not changed:
        print(f"Info: no changes required ({action})")
    else:
        print(f"✅ pi-extensions {verb} ({action})")

    return 0


def pi_extensions_install(scope: str, package_names: Optional[list[str]], dry_run: bool) -> int:
    return _install_or_remove_pi_extensions(
        action="install",
        scope=scope,
        package_names=package_names,
        dry_run=dry_run,
    )


def pi_extensions_uninstall(scope: str, package_names: Optional[list[str]], dry_run: bool) -> int:
    return _install_or_remove_pi_extensions(
        action="remove",
        scope=scope,
        package_names=package_names,
        dry_run=dry_run,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AGENTS.md / pi-extensions setup helper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    link_parser = subparsers.add_parser("link", help="Create AGENTS.md symlinks")
    link_parser.add_argument(
        "--replace-symlinks",
        action="store_true",
        help="Replace symlinks that point somewhere else",
    )

    subparsers.add_parser("health", help="Check AGENTS.md link health")
    subparsers.add_parser("list", help="List configured AGENTS.md targets")

    extensions_parser = subparsers.add_parser("extensions", help="Manage local pi extension packages")
    extensions_subparsers = extensions_parser.add_subparsers(dest="extensions_command", required=True)

    ext_health_parser = extensions_subparsers.add_parser("health", help="Check pi-extensions install health")
    ext_health_parser.add_argument(
        "--scope",
        choices=SUPPORTED_PI_SCOPES,
        default="both",
        help="Target scope to inspect",
    )
    ext_health_parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero if selected scope has missing packages or settings errors",
    )

    ext_install_parser = extensions_subparsers.add_parser("install", help="Install pi-extensions packages via pi install")
    ext_install_parser.add_argument(
        "--scope",
        choices=SUPPORTED_PI_SCOPES,
        default="global",
        help="Where to install packages",
    )
    ext_install_parser.add_argument(
        "--package",
        action="append",
        dest="packages",
        help="Package name to install (repeatable). Defaults to all discovered packages",
    )
    ext_install_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing",
    )

    ext_uninstall_parser = extensions_subparsers.add_parser(
        "uninstall", help="Uninstall pi-extensions packages via pi remove"
    )
    ext_uninstall_parser.add_argument(
        "--scope",
        choices=SUPPORTED_PI_SCOPES,
        default="global",
        help="Where to uninstall packages",
    )
    ext_uninstall_parser.add_argument(
        "--package",
        action="append",
        dest="packages",
        help="Package name to uninstall (repeatable). Defaults to all discovered packages",
    )
    ext_uninstall_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing",
    )

    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "link":
        return link(replace_symlinks=args.replace_symlinks)
    if args.command == "health":
        return health()
    if args.command == "list":
        return list_targets()
    if args.command == "extensions":
        if args.extensions_command == "health":
            return pi_extensions_health(scope=args.scope, strict=args.strict)
        if args.extensions_command == "install":
            return pi_extensions_install(
                scope=args.scope,
                package_names=args.packages,
                dry_run=args.dry_run,
            )
        if args.extensions_command == "uninstall":
            return pi_extensions_uninstall(
                scope=args.scope,
                package_names=args.packages,
                dry_run=args.dry_run,
            )
        parser.error(f"Unknown extensions command: {args.extensions_command}")
        return 1

    parser.error(f"Unknown command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
