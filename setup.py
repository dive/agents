#!/usr/bin/env python3
"""Manage global AGENTS.md links for coding tools."""

from __future__ import annotations

import argparse
import os
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AGENTS.md setup helper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    link_parser = subparsers.add_parser("link", help="Create AGENTS.md symlinks")
    link_parser.add_argument(
        "--replace-symlinks",
        action="store_true",
        help="Replace symlinks that point somewhere else",
    )

    subparsers.add_parser("health", help="Check link health")
    subparsers.add_parser("list", help="List configured link targets")
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

    parser.error(f"Unknown command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
