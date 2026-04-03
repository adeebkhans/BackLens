# Usage Guide

This guide focuses on effective day-to-day use of BackLens.

## Core Workflows

## 1) Analyze a Project

Extension mode:

1. Run BackLens: Analyze Folder.
2. Wait for parse, graph build, and DB save completion.
3. Open graph view.

Standalone mode:

1. Parse project with parser package.
2. Build graph JSON.
3. Save SQLite.
4. Start API and web UI.

## 2) Search Nodes

Use search in the left panel to find functions, methods, classes, or files and add them to the graph.

## 3) Open Hotspots

In Hotspots tab:

1. Click Load.
2. Choose a hotspot to open centered context.

Hotspots help you find highly connected nodes quickly.

## 4) Inspect Classes and Methods

In Classes tab:

1. Load classes.
2. Expand a class to lazy-load methods.
3. Click class/method to add it to graph.

## 5) Expand Callers

From inspector:

- Expand Callers shows who depends on the selected node.

Use this to trace impact radius.

## 6) Expand Callees

From inspector:

- Expand Callees shows what the selected node depends on.

Use this to trace dependencies.

## 7) Follow Call Chains

Use path operations (available in provider/API contracts) to inspect shortest or full path chains between two nodes.

## 8) Jump to Source

In extension mode:

- Double-click a graph node to navigate to source location.
- Or use BackLens: Go to Source command path.

## 9) Close or Reload Project Context

Use BackLens explorer actions:

- Re-analyze Folder to refresh graph from latest code.
- Close Project to unload current context.

## How to Read the Graph

## Node Types

- Function: standalone callable code unit.
- Method: callable member of a class.
- Class: object-oriented container for methods.
- File: source file container node.
- External: dependency outside your codebase.
- Placeholder: unresolved or intermediate call target.

## Caller vs Callee

- Caller edge direction means source node invokes target node.
- Expand Callers moves upstream to dependents.
- Expand Callees moves downstream to dependencies.

## Hotspots

Hotspots are nodes with high fan-in and fan-out score. These often indicate coordination-heavy or risky change points.

## External Nodes

External nodes represent modules/framework calls not modeled as local source nodes.

## Unresolved Edges

Unresolved edges can appear due to:

- dynamic dispatch
- runtime-generated behavior
- framework indirection
- alias-heavy patterns

This is expected in static analysis workflows.