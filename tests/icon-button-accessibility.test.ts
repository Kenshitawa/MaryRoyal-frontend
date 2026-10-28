import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(process.cwd(), "src");
const sourceFiles = ts.sys.readDirectory(sourceRoot, [".tsx"], ["node_modules"], ["**/*"]);

function hasVisibleText(node: ts.Node): boolean {
  if (ts.isJsxText(node)) return node.getText().trim().length > 0;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text.trim().length > 0;
  return node.getChildren().some(hasVisibleText);
}

function hasIcon(node: ts.Node): boolean {
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
    return node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText() === "size");
  }
  return node.getChildren().some(hasIcon);
}

function hasAccessibleName(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): boolean {
  return node.attributes.properties.some((attribute) =>
    ts.isJsxAttribute(attribute)
    && ["aria-label", "aria-labelledby", "title"].includes(attribute.name.getText())
    && attribute.initializer !== undefined,
  );
}

describe("icon-only button accessibility", () => {
  it("requires every icon-only button to declare an accessible name", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, "utf8");
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === "button") {
          const iconOnly = !node.children.some(hasVisibleText) && node.children.some(hasIcon);
          if (iconOnly && !hasAccessibleName(node.openingElement)) {
            const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
            violations.push(`${path.relative(sourceRoot, file)}:${position.line + 1}`);
          }
        }
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === "button" && hasIcon(node) && !hasAccessibleName(node)) {
          const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
          violations.push(`${path.relative(sourceRoot, file)}:${position.line + 1}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
    expect(violations).toEqual([]);
  });
});
