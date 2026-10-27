#!/usr/bin/env python3
"""Static catalog helper for focused-spec Python scenarios."""

from __future__ import annotations

import ast
import json
import keyword
import math
import sys
from dataclasses import dataclass
from typing import Any, NoReturn

INPUT_LIMIT = 4_000_000
SDK_MODULE = "focused_spec_scenarios"


@dataclass
class SourceError(Exception):
    message: str
    line: int = 1

    def __str__(self) -> str:
        return self.message


def fail(node: ast.AST | None, message: str) -> NoReturn:
    raise SourceError(message, max(1, getattr(node, "lineno", 1)))


def public_identifier(value: object) -> bool:
    return isinstance(value, str) and value.isidentifier() and not keyword.iskeyword(value) and not value.startswith("_")


def valid_id(value: object) -> bool:
    return (
        isinstance(value, str)
        and bool(value.strip())
        and not any(ord(char) < 32 or 127 <= ord(char) < 160 for char in value)
    )


class Analyzer:
    def __init__(self, tree: ast.Module) -> None:
        self.tree = tree
        self.names: dict[str, str] = {}
        self.modules: set[str] = set()

    def imports(self) -> None:
        for statement in self.tree.body:
            if isinstance(statement, ast.ImportFrom) and statement.module == SDK_MODULE:
                for alias in statement.names:
                    if alias.name == "*":
                        fail(alias, "focused_spec_scenarios star imports are unsupported")
                    local = alias.asname or alias.name
                    if local in self.names or local in self.modules:
                        fail(alias, f"duplicate imported name: {local}")
                    self.names[local] = alias.name
            elif isinstance(statement, ast.Import):
                for alias in statement.names:
                    if alias.name != SDK_MODULE:
                        continue
                    local = alias.asname or SDK_MODULE
                    if local in self.names or local in self.modules:
                        fail(alias, f"duplicate imported name: {local}")
                    self.modules.add(local)
        available = set(self.names.values())
        if not self.modules and not {"Scenario", "define_suite", "DriverBinding"}.issubset(available):
            raise SourceError(
                "scenario source must import Scenario, define_suite, and DriverBinding from focused_spec_scenarios",
                1,
            )

    def is_symbol(self, expression: ast.expr, name: str) -> bool:
        if isinstance(expression, ast.Name):
            return self.names.get(expression.id) == name
        return (
            isinstance(expression, ast.Attribute)
            and expression.attr == name
            and isinstance(expression.value, ast.Name)
            and expression.value.id in self.modules
        )

    def assignment(self) -> tuple[str, ast.expr]:
        result: tuple[str, ast.expr] | None = None
        for statement in self.tree.body:
            if isinstance(statement, (ast.Import, ast.ImportFrom)):
                continue
            name: str | None = None
            value: ast.expr | None = None
            if isinstance(statement, ast.Assign):
                if len(statement.targets) != 1 or not isinstance(statement.targets[0], ast.Name):
                    fail(statement, "suite assignment must have one top-level name")
                name = statement.targets[0].id
                value = statement.value
            elif isinstance(statement, ast.AnnAssign):
                if not isinstance(statement.target, ast.Name) or statement.value is None:
                    fail(statement, "suite assignment must have one top-level name and initializer")
                name = statement.target.id
                value = statement.value
            else:
                fail(statement, "only imports and one top-level suite assignment are supported")
            if result is not None:
                fail(statement, "scenario source requires exactly one suite assignment")
            if not public_identifier(name):
                fail(statement, "suite export must be a public Python identifier")
            result = (name, value)
        if result is None:
            raise SourceError("scenario source requires one top-level suite assignment", 1)
        return result

    def literal(self, expression: ast.expr, label: str) -> None:
        if isinstance(expression, ast.Constant):
            value = expression.value
            if value is None or isinstance(value, (str, bool, int)):
                return
            if isinstance(value, float) and math.isfinite(value):
                return
            fail(expression, f"{label} requires a supported literal value")
        if isinstance(expression, ast.UnaryOp) and isinstance(expression.op, ast.USub):
            operand = expression.operand
            if isinstance(operand, ast.Constant) and type(operand.value) in (int, float):
                value = -operand.value
                if type(value) is int or math.isfinite(value):
                    return
            fail(expression, f"{label} requires a finite negative numeric literal")
        if isinstance(expression, (ast.List, ast.Tuple)):
            for index, item in enumerate(expression.elts):
                if isinstance(item, ast.Starred):
                    fail(item, f"{label} does not support starred values")
                self.literal(item, f"{label}[{index}]")
            return
        if isinstance(expression, ast.Dict):
            keys: set[str] = set()
            for key, value in zip(expression.keys, expression.values, strict=True):
                if key is None:
                    fail(expression, f"{label} does not support dictionary unpacking")
                if not isinstance(key, ast.Constant) or not isinstance(key.value, str):
                    fail(key, f"{label} requires string dictionary keys")
                if key.value in keys:
                    fail(key, f"duplicate dictionary key: {key.value}")
                keys.add(key.value)
                self.literal(value, f"{label}.{key.value}")
            return
        fail(expression, f"{label} requires literal data; dynamic declarations are unsupported")

    def fields(self, call: ast.Call, names: tuple[str, ...], label: str) -> dict[str, ast.expr]:
        if any(isinstance(value, ast.Starred) for value in call.args):
            fail(call, f"{label} does not support starred arguments")
        if len(call.args) > len(names):
            fail(call, f"{label} accepts exactly {', '.join(names)}")
        result = {names[index]: value for index, value in enumerate(call.args)}
        for keyword in call.keywords:
            if keyword.arg is None:
                fail(keyword, f"{label} does not support keyword unpacking")
            if keyword.arg not in names:
                fail(keyword, f"unsupported {label} field: {keyword.arg}")
            if keyword.arg in result:
                fail(keyword, f"duplicate {label} field: {keyword.arg}")
            result[keyword.arg] = keyword.value
        missing = [name for name in names if name not in result]
        if missing:
            fail(call, f"{label} requires {', '.join(missing)}")
        return result

    def driver_binding(self, expression: ast.expr) -> dict[str, str]:
        if not isinstance(expression, ast.Call) or not self.is_symbol(expression.func, "DriverBinding"):
            fail(expression, "suite driver must be an explicit literal DriverBinding")
        fields = self.fields(expression, ("path", "export"), "DriverBinding")
        path_node = fields["path"]
        export_node = fields["export"]
        if not isinstance(path_node, ast.Constant) or not isinstance(path_node.value, str):
            fail(path_node, "DriverBinding path must be a string literal")
        if not path_node.value.strip() or any(ord(char) < 32 or 127 <= ord(char) < 160 for char in path_node.value):
            fail(path_node, "DriverBinding path must be nonblank and control-free")
        if not isinstance(export_node, ast.Constant) or not public_identifier(export_node.value):
            fail(export_node, "DriverBinding export must be a public Python identifier string")
        return {"path": path_node.value, "exportName": export_node.value}

    def scenario(self, expression: ast.expr) -> dict[str, object]:
        if not isinstance(expression, ast.Call) or not self.is_symbol(expression.func, "Scenario"):
            fail(expression, "suite positional arguments must be literal Scenario calls")
        fields = self.fields(expression, ("id", "name", "given", "when", "expect"), "Scenario")
        identity = fields["id"]
        name = fields["name"]
        if not isinstance(identity, ast.Constant) or not valid_id(identity.value):
            fail(identity, "Scenario id must be a nonblank control-free string literal")
        if not isinstance(name, ast.Constant) or not isinstance(name.value, str) or not name.value.strip():
            fail(name, "Scenario name must be a nonblank string literal")
        self.literal(fields["given"], f"{identity.value} Given")
        self.literal(fields["when"], f"{identity.value} When")
        self.literal(fields["expect"], f"{identity.value} Expect")
        return {"id": identity.value, "name": name.value, "line": expression.lineno}

    def catalog(self) -> dict[str, object]:
        self.imports()
        export_name, expression = self.assignment()
        if not isinstance(expression, ast.Call) or not self.is_symbol(expression.func, "define_suite"):
            fail(expression, "suite assignment must call imported define_suite")
        if any(isinstance(value, ast.Starred) for value in expression.args):
            fail(expression, "define_suite does not support starred scenario arguments")
        driver_node: ast.expr | None = None
        for keyword in expression.keywords:
            if keyword.arg is None:
                fail(keyword, "define_suite does not support keyword unpacking")
            if keyword.arg != "driver":
                fail(keyword, f"unsupported define_suite field: {keyword.arg}")
            if driver_node is not None:
                fail(keyword, "duplicate define_suite driver field")
            driver_node = keyword.value
        if driver_node is None:
            fail(expression, "native discovery requires define_suite(..., driver=DriverBinding(...))")
        if not expression.args:
            fail(expression, "suite must contain at least one Scenario")
        scenarios = [self.scenario(value) for value in expression.args]
        identities: set[str] = set()
        for scenario in scenarios:
            identity = str(scenario["id"])
            if identity in identities:
                raise SourceError(f"duplicate scenario ID: {identity}", int(scenario["line"]))
            identities.add(identity)
        return {
            "suite": {"exportName": export_name, "driver": self.driver_binding(driver_node)},
            "scenarios": scenarios,
        }


def parse_source(path: str, source: str) -> ast.Module:
    try:
        return ast.parse(source, filename=path, mode="exec", type_comments=False)
    except SyntaxError as error:
        raise SourceError(error.msg, error.lineno or 1) from error


def read_driver(path: str, source: str, export_name: str) -> dict[str, str]:
    if not public_identifier(export_name):
        raise SourceError("driver export must be a public Python identifier", 1)
    tree = parse_source(path, source)
    matches: list[ast.AST] = []
    for statement in tree.body:
        if isinstance(statement, ast.Assign):
            matches.extend(target for target in statement.targets if isinstance(target, ast.Name) and target.id == export_name)
        elif isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name) and statement.target.id == export_name and statement.value is not None:
            matches.append(statement.target)
    if not matches:
        raise SourceError(f"expected top-level driver value: {export_name}", 1)
    if len(matches) != 1:
        fail(matches[1], f"duplicate top-level driver value: {export_name}")
    return {"exportName": export_name}


def handle(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise SourceError("invalid Python catalog request", 1)
    mode = value.get("mode")
    expected = {"mode", "path", "source"} | ({"exportName"} if mode == "driver" else set())
    if set(value) != expected or not isinstance(value.get("path"), str) or not isinstance(value.get("source"), str):
        raise SourceError("invalid Python catalog request fields", 1)
    path = value["path"]
    source = value["source"]
    if mode == "catalog":
        return {"ok": True, "catalog": Analyzer(parse_source(path, source)).catalog()}
    if mode == "driver" and isinstance(value.get("exportName"), str):
        return {"ok": True, "driver": read_driver(path, source, value["exportName"])}
    raise SourceError("Python catalog request requires mode catalog or driver", 1)


def main() -> None:
    try:
        raw = sys.stdin.buffer.read(INPUT_LIMIT + 1)
        if len(raw) > INPUT_LIMIT:
            raise SourceError("Python catalog request exceeds 4000000 bytes", 1)
        value = json.loads(raw)
        response = handle(value)
    except SourceError as error:
        response = {"ok": False, "error": {"message": error.message, "line": max(1, error.line)}}
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError) as error:
        response = {"ok": False, "error": {"message": f"invalid Python catalog request: {error}", "line": 1}}
    json.dump(response, sys.stdout, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
