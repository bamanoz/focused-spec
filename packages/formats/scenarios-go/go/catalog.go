package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/build/constraint"
	"go/parser"
	"go/scanner"
	"go/token"
	"io"
	"math"
	"os"
	"strconv"
	"strings"
)

const (
	inputLimit = 4_000_000
	sdkPath    = "github.com/bamanoz/focused-spec/packages/sdk/go"
)

type request struct {
	Mode       string `json:"mode"`
	Path       string `json:"path"`
	Source     string `json:"source"`
	ExportName string `json:"exportName"`
}

type diagnostic struct {
	Message string `json:"message"`
	Line    int    `json:"line"`
}

type catalogDriver struct {
	Path       string `json:"path"`
	ExportName string `json:"exportName"`
}

type catalogSuite struct {
	ExportName string        `json:"exportName"`
	PackageName string       `json:"packageName"`
	Driver     catalogDriver `json:"driver"`
}

type catalogScenario struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Line int    `json:"line"`
}

type catalog struct {
	Suite     catalogSuite      `json:"suite"`
	Scenarios []catalogScenario `json:"scenarios"`
}

type driverCatalog struct {
	PackageName string `json:"packageName"`
}

type response struct {
	OK      bool           `json:"ok"`
	Catalog *catalog       `json:"catalog,omitempty"`
	Driver  *driverCatalog `json:"driver,omitempty"`
	Error   *diagnostic    `json:"error,omitempty"`
}

type sourceError struct {
	message string
	line    int
}

func (e *sourceError) Error() string {
	return e.message
}

type analyzer struct {
	set   *token.FileSet
	file  *ast.File
	alias string
}

func main() {
	result := handle()
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(result); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func handle() response {
	input, err := io.ReadAll(io.LimitReader(os.Stdin, inputLimit+1))
	if err != nil {
		return failed(err.Error(), 1)
	}
	if len(input) > inputLimit {
		return failed("Go catalog request exceeds 4000000 bytes", 1)
	}
	decoder := json.NewDecoder(bytes.NewReader(input))
	decoder.DisallowUnknownFields()
	var value request
	if err := decoder.Decode(&value); err != nil {
		return failed("invalid Go catalog request: "+err.Error(), 1)
	}
	if err := requireEOF(decoder); err != nil {
		return failed("invalid Go catalog request: "+err.Error(), 1)
	}

	switch value.Mode {
	case "catalog":
		result, err := readCatalog(value.Path, value.Source)
		if err != nil {
			return failure(err)
		}
		return response{OK: true, Catalog: result}
	case "driver":
		result, err := readDriver(value.Path, value.Source, value.ExportName)
		if err != nil {
			return failure(err)
		}
		return response{OK: true, Driver: result}
	default:
		return failed("Go catalog request requires mode catalog or driver", 1)
	}
}

func requireEOF(decoder *json.Decoder) error {
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return errors.New("multiple JSON values")
		}
		return err
	}
	return nil
}

func failed(message string, line int) response {
	if line < 1 {
		line = 1
	}
	return response{OK: false, Error: &diagnostic{Message: message, Line: line}}
}

func failure(err error) response {
	var source *sourceError
	if errors.As(err, &source) {
		return failed(source.message, source.line)
	}
	return failed(err.Error(), 1)
}

func parseSource(path, source string) (*token.FileSet, *ast.File, error) {
	set := token.NewFileSet()
	file, err := parser.ParseFile(set, path, source, parser.AllErrors|parser.ParseComments)
	if err != nil {
		line := 1
		if list, ok := err.(scanner.ErrorList); ok && len(list) > 0 && list[0].Pos.Line > 0 {
			line = list[0].Pos.Line
		}
		return nil, nil, &sourceError{message: err.Error(), line: line}
	}
	return set, file, nil
}

func readCatalog(path, source string) (*catalog, error) {
	if !strings.HasSuffix(path, ".scenarios.go") || strings.HasSuffix(path, "_test.go") {
		return nil, &sourceError{message: "scenario source must end in .scenarios.go and must not be a test file", line: 1}
	}
	set, file, err := parseSource(path, source)
	if err != nil {
		return nil, err
	}
	if file.Name == nil || file.Name.Name == "" || file.Name.Name == "main" {
		return nil, at(set, file.Package, "scenario source requires a non-main package")
	}
	for _, group := range file.Comments {
		if group.Pos() >= file.Package {
			continue
		}
		for _, comment := range group.List {
			if constraint.IsGoBuild(comment.Text) || constraint.IsPlusBuild(comment.Text) {
				return nil, at(set, comment.Pos(), "build constraints are unsupported in scenario sources")
			}
		}
	}

	alias, err := sdkAlias(set, file)
	if err != nil {
		return nil, err
	}
	analysis := analyzer{set: set, file: file, alias: alias}
	name, literal, err := analysis.suiteDeclaration()
	if err != nil {
		return nil, err
	}
	fields, err := analysis.fields(literal, []string{"Driver", "Scenarios"}, "suite")
	if err != nil {
		return nil, err
	}
	driver, err := analysis.driver(fields["Driver"])
	if err != nil {
		return nil, err
	}
	scenarios, err := analysis.scenarios(fields["Scenarios"])
	if err != nil {
		return nil, err
	}
	return &catalog{
		Suite: catalogSuite{ExportName: name, PackageName: file.Name.Name, Driver: driver},
		Scenarios: scenarios,
	}, nil
}

func readDriver(path, source, exportName string) (*driverCatalog, error) {
	if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
		return nil, &sourceError{message: "driver source must be a non-test .go file", line: 1}
	}
	if !token.IsIdentifier(exportName) || !ast.IsExported(exportName) {
		return nil, &sourceError{message: "driver export must be an exported Go identifier", line: 1}
	}
	set, file, err := parseSource(path, source)
	if err != nil {
		return nil, err
	}
	if file.Name == nil || file.Name.Name == "" || file.Name.Name == "main" {
		return nil, at(set, file.Package, "driver source requires a non-main package")
	}
	var found token.Pos
	for _, declaration := range file.Decls {
		general, ok := declaration.(*ast.GenDecl)
		if !ok || general.Tok != token.VAR {
			continue
		}
		for _, specification := range general.Specs {
			values, ok := specification.(*ast.ValueSpec)
			if !ok {
				continue
			}
			for _, name := range values.Names {
				if name.Name != exportName {
					continue
				}
				if found.IsValid() {
					return nil, at(set, name.Pos(), "duplicate top-level driver variable: "+exportName)
				}
				found = name.Pos()
			}
		}
	}
	if !found.IsValid() {
		return nil, &sourceError{message: "expected top-level exported driver variable: " + exportName, line: 1}
	}
	return &driverCatalog{PackageName: file.Name.Name}, nil
}

func sdkAlias(set *token.FileSet, file *ast.File) (string, error) {
	alias := ""
	for _, specification := range file.Imports {
		path, err := strconv.Unquote(specification.Path.Value)
		if err != nil {
			return "", at(set, specification.Path.Pos(), "invalid import path")
		}
		if path != sdkPath {
			continue
		}
		if alias != "" {
			return "", at(set, specification.Pos(), "scenario source must import the Go SDK exactly once")
		}
		if specification.Name == nil {
			alias = "scenarios"
			continue
		}
		if specification.Name.Name == "." || specification.Name.Name == "_" {
			return "", at(set, specification.Name.Pos(), "Go SDK import must use its package name or a local alias")
		}
		alias = specification.Name.Name
	}
	if alias == "" {
		return "", &sourceError{message: "scenario source must import " + sdkPath, line: 1}
	}
	return alias, nil
}

func (a analyzer) suiteDeclaration() (string, *ast.CompositeLit, error) {
	var suite *ast.ValueSpec
	for _, declaration := range a.file.Decls {
		switch value := declaration.(type) {
		case *ast.GenDecl:
			switch value.Tok {
			case token.IMPORT:
				continue
			case token.VAR:
				if suite != nil || len(value.Specs) != 1 {
					return "", nil, at(a.set, value.Pos(), "scenario source requires exactly one suite variable declaration")
				}
				candidate, ok := value.Specs[0].(*ast.ValueSpec)
				if !ok || len(candidate.Names) != 1 || len(candidate.Values) != 1 || candidate.Type != nil {
					return "", nil, at(a.set, value.Pos(), "suite variable must have one name and one literal initializer")
				}
				suite = candidate
			default:
				return "", nil, at(a.set, value.Pos(), "only imports and one suite variable are supported")
			}
		default:
			return "", nil, at(a.set, value.Pos(), "functions and executable declarations are unsupported in scenario sources")
		}
	}
	if suite == nil {
		return "", nil, &sourceError{message: "scenario source requires one exported suite variable", line: 1}
	}
	name := suite.Names[0]
	if !ast.IsExported(name.Name) {
		return "", nil, at(a.set, name.Pos(), "suite variable must be exported")
	}
	expression := unwrap(suite.Values[0])
	literal, ok := expression.(*ast.CompositeLit)
	if !ok || !genericSelector(literal.Type, a.alias, "Suite", 3) {
		return "", nil, at(a.set, expression.Pos(), "suite variable must be initialized by a scenarios.Suite literal")
	}
	if !validTypeArguments(literal.Type) {
		return "", nil, at(a.set, literal.Type.Pos(), "suite type arguments must be static Go types")
	}
	return name.Name, literal, nil
}

func (a analyzer) driver(expression ast.Expr) (catalogDriver, error) {
	expression = unwrap(expression)
	literal, ok := expression.(*ast.CompositeLit)
	if !ok || !selector(literal.Type, a.alias, "DriverBinding") {
		return catalogDriver{}, at(a.set, expression.Pos(), "Driver must be a scenarios.DriverBinding literal")
	}
	fields, err := a.fields(literal, []string{"Path", "Export"}, "Driver")
	if err != nil {
		return catalogDriver{}, err
	}
	path, err := a.stringLiteral(fields["Path"], "Driver.Path")
	if err != nil {
		return catalogDriver{}, err
	}
	exportName, err := a.stringLiteral(fields["Export"], "Driver.Export")
	if err != nil {
		return catalogDriver{}, err
	}
	if strings.TrimSpace(path) == "" || hasControl(path) {
		return catalogDriver{}, at(a.set, fields["Path"].Pos(), "Driver.Path must be nonblank and control-free")
	}
	if !token.IsIdentifier(exportName) || !ast.IsExported(exportName) {
		return catalogDriver{}, at(a.set, fields["Export"].Pos(), "Driver.Export must be an exported Go identifier")
	}
	return catalogDriver{Path: path, ExportName: exportName}, nil
}

func (a analyzer) scenarios(expression ast.Expr) ([]catalogScenario, error) {
	expression = unwrap(expression)
	literal, ok := expression.(*ast.CompositeLit)
	if !ok {
		return nil, at(a.set, expression.Pos(), "Scenarios must be a literal slice or array")
	}
	array, ok := literal.Type.(*ast.ArrayType)
	if !ok || !genericSelector(array.Elt, a.alias, "Scenario", 3) || !validTypeArguments(array.Elt) {
		return nil, at(a.set, literal.Type.Pos(), "Scenarios must use scenarios.Scenario with three static type arguments")
	}
	if array.Len != nil {
		if _, ellipsis := array.Len.(*ast.Ellipsis); !ellipsis {
			if basic, ok := array.Len.(*ast.BasicLit); !ok || basic.Kind != token.INT {
				return nil, at(a.set, array.Len.Pos(), "scenario array length must be a literal integer")
			}
		}
	}

	result := make([]catalogScenario, 0, len(literal.Elts))
	ids := make(map[string]struct{}, len(literal.Elts))
	for _, element := range literal.Elts {
		if _, keyed := element.(*ast.KeyValueExpr); keyed {
			return nil, at(a.set, element.Pos(), "scenario collection cannot use keyed or sparse elements")
		}
		scenarioLiteral, ok := unwrap(element).(*ast.CompositeLit)
		if !ok {
			return nil, at(a.set, element.Pos(), "each scenario must be a literal composite")
		}
		if scenarioLiteral.Type != nil && (!genericSelector(scenarioLiteral.Type, a.alias, "Scenario", 3) || !validTypeArguments(scenarioLiteral.Type)) {
			return nil, at(a.set, scenarioLiteral.Type.Pos(), "scenario element must use the suite Scenario type")
		}
		fields, err := a.fields(scenarioLiteral, []string{"ID", "Name", "Given", "When", "Expect"}, "scenario")
		if err != nil {
			return nil, err
		}
		id, err := a.stringLiteral(fields["ID"], "scenario.ID")
		if err != nil {
			return nil, err
		}
		if strings.TrimSpace(id) == "" || hasControl(id) {
			return nil, at(a.set, fields["ID"].Pos(), "scenario.ID must contain non-whitespace and no control characters")
		}
		if _, duplicate := ids[id]; duplicate {
			return nil, at(a.set, fields["ID"].Pos(), "duplicate scenario ID: "+id)
		}
		ids[id] = struct{}{}
		name, err := a.stringLiteral(fields["Name"], "scenario.Name")
		if err != nil {
			return nil, err
		}
		if strings.TrimSpace(name) == "" {
			return nil, at(a.set, fields["Name"].Pos(), "scenario.Name must be nonblank")
		}
		for _, field := range []string{"Given", "When", "Expect"} {
			if err := a.data(fields[field]); err != nil {
				return nil, err
			}
		}
		result = append(result, catalogScenario{ID: id, Name: name, Line: line(a.set, scenarioLiteral.Pos())})
	}
	return result, nil
}

func (a analyzer) fields(literal *ast.CompositeLit, required []string, label string) (map[string]ast.Expr, error) {
	allowed := make(map[string]struct{}, len(required))
	for _, name := range required {
		allowed[name] = struct{}{}
	}
	fields := make(map[string]ast.Expr, len(required))
	for _, element := range literal.Elts {
		field, ok := element.(*ast.KeyValueExpr)
		if !ok {
			return nil, at(a.set, element.Pos(), label+" requires keyed fields")
		}
		name, ok := field.Key.(*ast.Ident)
		if !ok {
			return nil, at(a.set, field.Key.Pos(), label+" field names must be identifiers")
		}
		if _, ok := allowed[name.Name]; !ok {
			return nil, at(a.set, name.Pos(), "unsupported "+label+" field: "+name.Name)
		}
		if _, duplicate := fields[name.Name]; duplicate {
			return nil, at(a.set, name.Pos(), "duplicate "+label+" field: "+name.Name)
		}
		fields[name.Name] = field.Value
	}
	for _, name := range required {
		if _, ok := fields[name]; !ok {
			return nil, at(a.set, literal.Pos(), label+" requires exactly "+strings.Join(required, ", "))
		}
	}
	return fields, nil
}

func (a analyzer) stringLiteral(expression ast.Expr, label string) (string, error) {
	expression = unwrap(expression)
	literal, ok := expression.(*ast.BasicLit)
	if !ok || literal.Kind != token.STRING {
		return "", at(a.set, expression.Pos(), label+" must be a string literal")
	}
	value, err := strconv.Unquote(literal.Value)
	if err != nil {
		return "", at(a.set, literal.Pos(), "invalid "+label+" string literal")
	}
	return value, nil
}

func (a analyzer) data(expression ast.Expr) error {
	expression = unwrap(expression)
	switch value := expression.(type) {
	case *ast.BasicLit:
		switch value.Kind {
		case token.STRING, token.INT:
			return nil
		case token.FLOAT:
			number, err := strconv.ParseFloat(strings.ReplaceAll(value.Value, "_", ""), 64)
			if err != nil || math.IsInf(number, 0) || math.IsNaN(number) {
				return at(a.set, value.Pos(), "numeric literal must be finite")
			}
			return nil
		default:
			return at(a.set, value.Pos(), "expected literal data")
		}
	case *ast.Ident:
		if value.Name == "true" || value.Name == "false" || value.Name == "nil" {
			return nil
		}
		return at(a.set, value.Pos(), "constant references and dynamic identifiers are unsupported in scenario data")
	case *ast.UnaryExpr:
		if value.Op != token.SUB {
			return at(a.set, value.Pos(), "only negative numeric unary literals are supported")
		}
		literal, ok := unwrap(value.X).(*ast.BasicLit)
		if !ok || (literal.Kind != token.INT && literal.Kind != token.FLOAT) {
			return at(a.set, value.Pos(), "negative values must contain a numeric literal")
		}
		return a.data(literal)
	case *ast.CompositeLit:
		return a.compositeData(value)
	default:
		return at(a.set, expression.Pos(), "expected literal data; executable expressions are unsupported")
	}
}

func (a analyzer) compositeData(literal *ast.CompositeLit) error {
	if literal.Type == nil {
		return a.elidedComposite(literal)
	}
	switch value := literal.Type.(type) {
	case *ast.ArrayType:
		if value.Len != nil {
			if _, ellipsis := value.Len.(*ast.Ellipsis); !ellipsis {
				if basic, ok := value.Len.(*ast.BasicLit); !ok || basic.Kind != token.INT {
					return at(a.set, value.Len.Pos(), "array length must be a literal integer")
				}
			}
		}
		for _, element := range literal.Elts {
			if _, keyed := element.(*ast.KeyValueExpr); keyed {
				return at(a.set, element.Pos(), "arrays and slices must use dense literal elements")
			}
			if err := a.data(element); err != nil {
				return err
			}
		}
		return nil
	case *ast.MapType:
		key, ok := value.Key.(*ast.Ident)
		if !ok || key.Name != "string" {
			return at(a.set, value.Key.Pos(), "scenario maps must use string keys")
		}
		return a.mapElements(literal.Elts)
	default:
		if !validNamedType(literal.Type) {
			return at(a.set, literal.Type.Pos(), "composite data must use an array, slice, string-keyed map, or named struct type")
		}
		return a.structElements(literal.Elts)
	}
}

func (a analyzer) elidedComposite(literal *ast.CompositeLit) error {
	if len(literal.Elts) == 0 {
		return nil
	}
	keyed := 0
	for _, element := range literal.Elts {
		if _, ok := element.(*ast.KeyValueExpr); ok {
			keyed++
		}
	}
	if keyed == 0 {
		for _, element := range literal.Elts {
			if err := a.data(element); err != nil {
				return err
			}
		}
		return nil
	}
	if keyed != len(literal.Elts) {
		return at(a.set, literal.Pos(), "composite literals cannot mix keyed and unkeyed elements")
	}
	first := literal.Elts[0].(*ast.KeyValueExpr)
	switch first.Key.(type) {
	case *ast.Ident:
		return a.structElements(literal.Elts)
	case *ast.BasicLit:
		return a.mapElements(literal.Elts)
	default:
		return at(a.set, first.Key.Pos(), "unsupported literal composite key")
	}
}

func (a analyzer) structElements(elements []ast.Expr) error {
	fields := make(map[string]struct{}, len(elements))
	for _, element := range elements {
		field, ok := element.(*ast.KeyValueExpr)
		if !ok {
			return at(a.set, element.Pos(), "struct data requires explicit keyed fields")
		}
		name, ok := field.Key.(*ast.Ident)
		if !ok {
			return at(a.set, field.Key.Pos(), "struct data field names must be identifiers")
		}
		if _, duplicate := fields[name.Name]; duplicate {
			return at(a.set, name.Pos(), "duplicate struct field: "+name.Name)
		}
		fields[name.Name] = struct{}{}
		if err := a.data(field.Value); err != nil {
			return err
		}
	}
	return nil
}

func (a analyzer) mapElements(elements []ast.Expr) error {
	keys := make(map[string]struct{}, len(elements))
	for _, element := range elements {
		entry, ok := element.(*ast.KeyValueExpr)
		if !ok {
			return at(a.set, element.Pos(), "map data requires literal key-value entries")
		}
		key, err := a.stringLiteral(entry.Key, "map key")
		if err != nil {
			return err
		}
		if _, duplicate := keys[key]; duplicate {
			return at(a.set, entry.Key.Pos(), "duplicate map key: "+key)
		}
		keys[key] = struct{}{}
		if err := a.data(entry.Value); err != nil {
			return err
		}
	}
	return nil
}

func genericSelector(expression ast.Expr, alias, name string, arguments int) bool {
	switch value := expression.(type) {
	case *ast.IndexListExpr:
		return len(value.Indices) == arguments && selector(value.X, alias, name)
	case *ast.IndexExpr:
		return arguments == 1 && selector(value.X, alias, name)
	default:
		return false
	}
}

func selector(expression ast.Expr, alias, name string) bool {
	value, ok := expression.(*ast.SelectorExpr)
	if !ok || value.Sel.Name != name {
		return false
	}
	packageName, ok := value.X.(*ast.Ident)
	return ok && packageName.Name == alias
}

func validTypeArguments(expression ast.Expr) bool {
	switch value := expression.(type) {
	case *ast.IndexListExpr:
		for _, argument := range value.Indices {
			if !validType(argument) {
				return false
			}
		}
		return true
	case *ast.IndexExpr:
		return validType(value.Index)
	default:
		return false
	}
}

func validType(expression ast.Expr) bool {
	switch value := expression.(type) {
	case *ast.Ident:
		return true
	case *ast.SelectorExpr:
		return validType(value.X)
	case *ast.StarExpr:
		return validType(value.X)
	case *ast.ArrayType:
		if value.Len != nil {
			switch length := value.Len.(type) {
			case *ast.Ellipsis:
			case *ast.BasicLit:
				if length.Kind != token.INT {
					return false
				}
			default:
				return false
			}
		}
		return validType(value.Elt)
	case *ast.MapType:
		return validType(value.Key) && validType(value.Value)
	case *ast.IndexExpr:
		return validType(value.X) && validType(value.Index)
	case *ast.IndexListExpr:
		if !validType(value.X) {
			return false
		}
		for _, argument := range value.Indices {
			if !validType(argument) {
				return false
			}
		}
		return true
	case *ast.ParenExpr:
		return validType(value.X)
	default:
		return false
	}
}

func validNamedType(expression ast.Expr) bool {
	switch value := expression.(type) {
	case *ast.Ident:
		return true
	case *ast.SelectorExpr:
		return validType(value.X)
	case *ast.IndexExpr:
		return validType(value.X) && validType(value.Index)
	case *ast.IndexListExpr:
		return validType(value)
	default:
		return false
	}
}

func unwrap(expression ast.Expr) ast.Expr {
	for {
		parenthesized, ok := expression.(*ast.ParenExpr)
		if !ok {
			return expression
		}
		expression = parenthesized.X
	}
}

func hasControl(value string) bool {
	for _, character := range value {
		if character <= 0x1f || (character >= 0x7f && character <= 0x9f) {
			return true
		}
	}
	return false
}

func line(set *token.FileSet, position token.Pos) int {
	value := set.Position(position).Line
	if value < 1 {
		return 1
	}
	return value
}

func at(set *token.FileSet, position token.Pos, message string) error {
	return &sourceError{message: message, line: line(set, position)}
}
