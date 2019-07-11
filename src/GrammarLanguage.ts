import TreeNode from "./base/TreeNode"
import TreeUtils from "./base/TreeUtils"
import jTreeTypes from "./jTreeTypes"

interface AbstractRuntimeProgramConstructorInterface {
  new (code: string): GrammarBackedRootNode
}

enum GrammarConstantsCompiler {
  stringTemplate = "stringTemplate", // replacement instructions
  indentCharacter = "indentCharacter",
  catchAllCellDelimiter = "catchAllCellDelimiter",
  openChildren = "openChildren",
  joinChildrenWith = "joinChildrenWith",
  closeChildren = "closeChildren"
}

enum GrammarStandardCellTypeIds {
  any = "any",
  anyFirstWord = "anyFirstWord", // todo: remove
  extraWord = "extraWord",
  float = "float",
  number = "number",
  bit = "bit",
  bool = "bool",
  int = "int"
}

enum GrammarConstantsConstantTypes {
  boolean = "boolean",
  string = "string",
  int = "int",
  float = "float"
}

enum GrammarConstants {
  // node types
  extensions = "extensions",
  toolingDirective = "tooling",
  todoComment = "todo",
  version = "version",
  nodeTypeOrder = "nodeTypeOrder", // todo: do we need this? may be better to use inScope and a flag to indicate whether order is important.
  nodeType = "nodeType",
  cellType = "cellType",

  // error check time
  regex = "regex", // temporary?
  reservedWords = "reservedWords", // temporary?
  enumFromGrammar = "enumFromGrammar", // temporary?
  enum = "enum", // temporary?

  // baseNodeTypes
  baseNodeType = "baseNodeType",
  blobNode = "blobNode",
  errorNode = "errorNode",

  // parse time
  extends = "extends",
  abstract = "abstract",
  root = "root",
  match = "match",
  inScope = "inScope",
  cells = "cells",
  catchAllCellType = "catchAllCellType",
  firstCellType = "firstCellType",
  catchAllNodeType = "catchAllNodeType",
  constants = "constants",
  required = "required", // Require this nodeType to be present in a node or program
  single = "single", // Have at most 1 of these
  tags = "tags",

  // code
  javascript = "javascript",

  // compile time
  compilerNodeType = "compiler",
  compilesTo = "compilesTo",

  // develop time
  description = "description",
  example = "example",
  frequency = "frequency", // todo: remove. switch to conditional frequencies. potentially do that outside this core lang.
  highlightScope = "highlightScope"
}

// todo: can we merge these methods into base TreeNode and ditch this class?
abstract class GrammarBackedNode extends TreeNode {
  abstract getDefinition(): AbstractGrammarDefinitionNode

  getAutocompleteResults(partialWord: string, cellIndex: jTreeTypes.positiveInt) {
    return cellIndex === 0 ? this._getAutocompleteResultsForFirstWord(partialWord) : this._getAutocompleteResultsForCell(partialWord, cellIndex)
  }

  getChildInstancesOfNodeTypeId(nodeTypeId: jTreeTypes.nodeTypeId): GrammarBackedNode[] {
    return this.filter(node => node.doesExtend(nodeTypeId))
  }

  getCatchAllNodeConstructor(line: string): Function {
    return this.getRootNode().getCatchAllNodeConstructor(line)
  }

  doesExtend(nodeTypeId: jTreeTypes.nodeTypeId) {
    return this.getDefinition()._doesExtend(nodeTypeId)
  }

  _getErrorNodeErrors() {
    return [this.getFirstWord() ? new UnknownNodeTypeError(this) : new BlankLineError(this)]
  }

  _getBlobNodeCatchAllNodeType() {
    return GrammarBackedBlobNode
  }

  private _getAutocompleteResultsForFirstWord(partialWord: string) {
    let defs: NonRootNodeTypeDefinition[] = Object.values(this.getDefinition().getFirstWordMapWithDefinitions())

    if (partialWord) defs = defs.filter(def => def._getFirstWordMatch().includes(partialWord))

    return defs.map(def => {
      const id = def._getFirstWordMatch()
      const description = def.getDescription()
      return {
        text: id,
        displayText: id + (description ? " " + description : "")
      }
    })
  }

  private _getAutocompleteResultsForCell(partialWord: string, cellIndex: jTreeTypes.positiveInt) {
    // todo: root should be [] correct?
    const cell = this._getGrammarBackedCellArray()[cellIndex]
    return cell ? cell.getAutoCompleteWords(partialWord) : []
  }

  // note: this is overwritten by the root node of a runtime grammar program.
  // some of the magic that makes this all work. but maybe there's a better way.
  abstract getGrammarProgramRoot(): GrammarProgram

  // todo: rename to something better?
  abstract getRootProgramNode(): GrammarBackedRootNode

  protected _getGrammarBackedCellArray(): AbstractGrammarBackedCell<any>[] {
    return []
  }

  getRunTimeEnumOptions(cell: AbstractGrammarBackedCell<any>): string[] {
    return undefined
  }

  protected _getRequiredNodeErrors(errors: jTreeTypes.TreeError[] = []) {
    Object.values(this.getDefinition().getFirstWordMapWithDefinitions()).forEach(def => {
      if (def.isRequired()) {
        const firstWord = def._getFirstWordMatch()
        if (!this.has(firstWord)) errors.push(new MissingRequiredNodeTypeError(this, firstWord))
      }
    })
    return errors
  }
}

abstract class GrammarBackedRootNode extends GrammarBackedNode {
  getRootProgramNode() {
    return this
  }

  getDefinition(): GrammarProgram {
    return this.getGrammarProgramRoot()
  }

  getInPlaceCellTypeTree() {
    return this.getTopDownArray()
      .map(child => child.getIndentation() + child.getLineCellTypes())
      .join("\n")
  }

  getParseTable(maxColumnWidth = 40) {
    const tree = new TreeNode(this.getInPlaceCellTypeTree())
    return new TreeNode(
      tree.getTopDownArray().map((node, lineNumber) => {
        const sourceNode = this.nodeAtLine(lineNumber)
        const errs = sourceNode.getErrors()
        const errorCount = errs.length
        const obj: any = {
          lineNumber: lineNumber,
          source: sourceNode.getIndentation() + sourceNode.getLine(),
          nodeType: sourceNode.constructor.name,
          cellTypes: node.getContent(),
          errorCount: errorCount
        }
        if (errorCount) obj.errorMessages = errs.map(err => err.getMessage()).join(";")
        return obj
      })
    ).toFormattedTable(maxColumnWidth)
  }

  getErrors(): jTreeTypes.TreeError[] {
    return this._getRequiredNodeErrors(super.getErrors())
  }

  // Helper method for selecting potential nodeTypes needed to update grammar file.
  getInvalidNodeTypes() {
    return Array.from(
      new Set(
        this.getAllErrors()
          .filter(err => err instanceof UnknownNodeTypeError)
          .map(err => err.getNode().getFirstWord())
      )
    )
  }

  updateNodeTypeIds(nodeTypeMap: TreeNode | string | jTreeTypes.nodeIdRenameMap) {
    if (typeof nodeTypeMap === "string") nodeTypeMap = new TreeNode(nodeTypeMap)
    if (nodeTypeMap instanceof TreeNode) nodeTypeMap = <jTreeTypes.nodeIdRenameMap>nodeTypeMap.toObject()
    const renames = []
    for (let node of this.getTopDownArrayIterator()) {
      const nodeTypeId = (<GrammarBackedNonRootNode>node).getNodeTypeId()
      const newId = nodeTypeMap[nodeTypeId]
      if (newId) renames.push([node, newId])
    }
    renames.forEach(pair => pair[0].setFirstWord(pair[1]))
    return this
  }

  getAllSuggestions() {
    return new TreeNode(
      this.getAllWordBoundaryCoordinates().map(coordinate => {
        const results = this.getAutocompleteResultsAt(coordinate.y, coordinate.x)
        return {
          line: coordinate.y,
          char: coordinate.x,
          word: results.word,
          suggestions: results.matches.map(m => m.text).join(" ")
        }
      })
    ).toTable()
  }

  getAutocompleteResultsAt(lineIndex: jTreeTypes.positiveInt, charIndex: jTreeTypes.positiveInt) {
    const lineNode = this.nodeAtLine(lineIndex) || this
    const nodeInScope = <GrammarBackedNode>lineNode.getNodeInScopeAtCharIndex(charIndex)

    // todo: add more tests
    // todo: second param this.childrenToString()
    // todo: change to getAutocomplete definitions

    const wordIndex = lineNode.getWordIndexAtCharacterIndex(charIndex)
    const wordProperties = lineNode.getWordProperties(wordIndex)
    return {
      startCharIndex: wordProperties.startCharIndex,
      endCharIndex: wordProperties.endCharIndex,
      word: wordProperties.word,
      matches: nodeInScope.getAutocompleteResults(wordProperties.word, wordIndex)
    }
  }

  // todo: cleanup!
  getPrettified() {
    const grammarProgram = this.getGrammarProgramRoot()
    const nodeTypeOrder = grammarProgram.getNodeTypeOrder()
    const isGrammarLanguage = grammarProgram.getGrammarName() === "grammar" // todo: generalize?
    const clone = new ExtendibleTreeNode(this.clone())
    if (isGrammarLanguage) {
      const familyTree = new GrammarProgram(this.toString()).getNodeTypeFamilyTree()
      const rank: { [id: string]: number } = {}
      familyTree.getTopDownArray().forEach((node, index) => {
        rank[node.getWord(0)] = index
      })
      const nodeAFirst = -1
      const nodeBFirst = 1
      clone._firstWordSort(nodeTypeOrder.split(" "), (nodeA, nodeB) => {
        const nodeARank = rank[nodeA.getWord(1)]
        const nodeBRank = rank[nodeB.getWord(1)]
        return nodeARank < nodeBRank ? nodeAFirst : nodeBFirst
      })
    } else {
      clone._firstWordSort(nodeTypeOrder.split(" "))
    }

    return clone.toString()
  }

  getNodeTypeUsage(filepath = "") {
    // returns a report on what nodeTypes from its language the program uses
    const usage = new TreeNode()
    const grammarProgram = this.getGrammarProgramRoot()
    grammarProgram.getConcreteAndAbstractNodeTypeDefinitions().forEach(def => {
      usage.appendLine([def.getNodeTypeIdFromDefinition(), "line-id", GrammarConstants.nodeType, def.getRequiredCellTypeIds().join(" ")].join(" "))
    })
    this.getTopDownArray().forEach((node, lineNumber) => {
      const stats = <TreeNode>usage.getNode(node.getNodeTypeId())
      stats.appendLine([filepath + "-" + lineNumber, node.getWords().join(" ")].join(" "))
    })
    return usage
  }

  getInPlaceHighlightScopeTree() {
    return this.getTopDownArray()
      .map(child => child.getIndentation() + child.getLineHighlightScopes())
      .join("\n")
  }

  getInPlaceCellTypeTreeWithNodeConstructorNames() {
    return this.getTopDownArray()
      .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLineCellTypes())
      .join("\n")
  }

  getTreeWithNodeTypes() {
    return this.getTopDownArray()
      .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLine())
      .join("\n")
  }

  getCellHighlightScopeAtPosition(lineIndex: number, wordIndex: number): jTreeTypes.highlightScope | undefined {
    this._initCellTypeCache()
    const typeNode = this._cache_highlightScopeTree.getTopDownArray()[lineIndex - 1]
    return typeNode ? typeNode.getWord(wordIndex - 1) : undefined
  }

  private _cache_programCellTypeStringMTime: number
  private _cache_highlightScopeTree: TreeNode
  private _cache_typeTree: TreeNode

  protected _initCellTypeCache(): void {
    const treeMTime = this.getTreeMTime()
    if (this._cache_programCellTypeStringMTime === treeMTime) return undefined

    this._cache_typeTree = new TreeNode(this.getInPlaceCellTypeTree())
    this._cache_highlightScopeTree = new TreeNode(this.getInPlaceHighlightScopeTree())
    this._cache_programCellTypeStringMTime = treeMTime
  }
}

abstract class GrammarBackedNonRootNode extends GrammarBackedNode {
  getRootProgramNode() {
    return (<GrammarBackedNode>this.getParent()).getRootProgramNode()
  }

  getNodeTypeId(): jTreeTypes.nodeTypeId {
    return this.getDefinition().getNodeTypeIdFromDefinition()
  }

  getDefinition(): NonRootNodeTypeDefinition {
    return this.getRootProgramNode()
      .getGrammarProgramRoot()
      .getNodeTypeDefinitionByNodeTypeId(this.constructor.name)
  }

  getGrammarProgramRoot() {
    return this.getRootProgramNode().getGrammarProgramRoot()
  }

  protected _getGrammarBackedCellArray(): AbstractGrammarBackedCell<any>[] {
    const definition = this.getDefinition()
    const grammarProgram = definition.getLanguageDefinitionProgram()
    const requiredCellTypeIds = definition.getRequiredCellTypeIds()
    const firstCellTypeId = definition.getFirstCellTypeId()
    const numberOfRequiredCells = requiredCellTypeIds.length + 1 // todo: assuming here first cell is required.

    const catchAllCellTypeId = definition.getCatchAllCellTypeId()

    const actualWordCountOrRequiredCellCount = Math.max(this.getWords().length, numberOfRequiredCells)
    const cells: AbstractGrammarBackedCell<any>[] = []

    // A for loop instead of map because "numberOfCellsToFill" can be longer than words.length
    for (let cellIndex = 0; cellIndex < actualWordCountOrRequiredCellCount; cellIndex++) {
      const isCatchAll = cellIndex >= numberOfRequiredCells

      let cellTypeId
      if (cellIndex === 0) cellTypeId = firstCellTypeId
      else if (isCatchAll) cellTypeId = catchAllCellTypeId
      else cellTypeId = requiredCellTypeIds[cellIndex - 1]

      let cellTypeDefinition = grammarProgram.getCellTypeDefinitionById(cellTypeId)

      let cellConstructor
      if (cellTypeDefinition) cellConstructor = cellTypeDefinition.getCellConstructor()
      else if (cellTypeId) cellConstructor = GrammarUnknownCellTypeCell
      else {
        cellConstructor = GrammarExtraWordCellTypeCell
        cellTypeId = GrammarStandardCellTypeIds.extraWord
        cellTypeDefinition = grammarProgram.getCellTypeDefinitionById(cellTypeId)
      }

      cells[cellIndex] = new cellConstructor(this, cellIndex, cellTypeDefinition, cellTypeId, isCatchAll)
    }
    return cells
  }

  // todo: just make a fn that computes proper spacing and then is given a node to print
  getLineCellTypes() {
    return this._getGrammarBackedCellArray()
      .map(slot => slot.getCellTypeId())
      .join(" ")
  }

  getLineHighlightScopes(defaultScope = "source") {
    return this._getGrammarBackedCellArray()
      .map(slot => slot.getHighlightScope() || defaultScope)
      .join(" ")
  }

  getErrors() {
    const errors = this._getGrammarBackedCellArray()
      .map(check => check.getErrorIfAny())
      .filter(i => i)

    const firstWord = this.getFirstWord()
    if (this.getDefinition().has(GrammarConstants.single))
      this.getParent()
        .findNodes(firstWord)
        .forEach((node, index) => {
          if (index) errors.push(new NodeTypeUsedMultipleTimesError(<GrammarBackedNode>node))
        })

    return this._getRequiredNodeErrors(errors)
  }

  protected _getCompiledIndentation() {
    const indentCharacter = this.getDefinition()._getCompilerObject()[GrammarConstantsCompiler.indentCharacter]
    const indent = this.getIndentation()
    return indentCharacter !== undefined ? indentCharacter.repeat(indent.length) : indent
  }

  protected _getCompiledLine() {
    const compiler = this.getDefinition()._getCompilerObject()
    const catchAllCellDelimiter = compiler[GrammarConstantsCompiler.catchAllCellDelimiter]
    const str = compiler[GrammarConstantsCompiler.stringTemplate]
    return str ? TreeUtils.formatStr(str, catchAllCellDelimiter, this.cells) : this.getLine()
  }

  compile() {
    const def = this.getDefinition()
    if (def.isTerminalNodeType()) return this._getCompiledIndentation() + this._getCompiledLine()

    const compiler = def._getCompilerObject()
    const openChildrenString = compiler[GrammarConstantsCompiler.openChildren] || ""
    const closeChildrenString = compiler[GrammarConstantsCompiler.closeChildren] || ""
    const childJoinCharacter = compiler[GrammarConstantsCompiler.joinChildrenWith] || "\n"

    const compiledLine = this._getCompiledLine()
    const indent = this._getCompiledIndentation()

    const compiledChildren = this.map(child => child.compile()).join(childJoinCharacter)

    return `${indent}${compiledLine}${openChildrenString}
${compiledChildren}
${indent}${closeChildrenString}`
  }

  // todo: remove
  get cells() {
    const cells: jTreeTypes.stringMap = {}
    this._getGrammarBackedCellArray().forEach(cell => {
      const cellTypeId = cell.getCellTypeId()
      if (!cell.isCatchAll()) cells[cellTypeId] = cell.getParsed()
      else {
        if (!cells[cellTypeId]) cells[cellTypeId] = []
        cells[cellTypeId].push(cell.getParsed())
      }
    })
    return cells
  }
}

class GrammarBackedBlobNode extends GrammarBackedNonRootNode {
  getFirstWordMap() {
    return {}
  }

  getErrors(): jTreeTypes.TreeError[] {
    return []
  }

  getCatchAllNodeConstructor(line: string) {
    return GrammarBackedBlobNode
  }
}

/*
A cell contains a word but also the type information for that word.
*/
abstract class AbstractGrammarBackedCell<T> {
  constructor(node: GrammarBackedNonRootNode, index: jTreeTypes.int, typeDef: GrammarCellTypeDefinitionNode, cellTypeId: string, isCatchAll: boolean) {
    this._typeDef = typeDef
    this._node = node
    this._isCatchAll = isCatchAll
    this._index = index
    this._cellTypeId = cellTypeId

    this._word = node.getWord(index)
  }

  private _node: GrammarBackedNonRootNode
  protected _index: jTreeTypes.int
  protected _word: string
  private _typeDef: GrammarCellTypeDefinitionNode
  private _isCatchAll: boolean
  private _cellTypeId: string

  getCellTypeId() {
    return this._cellTypeId
  }

  static parserFunctionName = ""

  getNode() {
    return this._node
  }

  getCellIndex() {
    return this._index
  }

  isCatchAll() {
    return this._isCatchAll
  }

  abstract getParsed(): T

  getHighlightScope(): string | undefined {
    const definition = this._getCellTypeDefinition()
    if (definition) return definition.getHighlightScope()
  }

  getAutoCompleteWords(partialWord: string = "") {
    const cellDef = this._getCellTypeDefinition()
    let words = cellDef ? cellDef._getAutocompleteWordOptions(this.getNode().getRootProgramNode()) : []

    const runTimeOptions = this.getNode().getRunTimeEnumOptions(this)
    if (runTimeOptions) words = runTimeOptions.concat(words)

    if (partialWord) words = words.filter(word => word.includes(partialWord))
    return words.map(word => {
      return {
        text: word,
        displayText: word
      }
    })
  }

  getWord() {
    return this._word
  }

  protected _getCellTypeDefinition() {
    return this._typeDef
  }

  protected _getFullLine() {
    return this.getNode().getLine()
  }

  protected _getErrorContext() {
    return this._getFullLine().split(" ")[0] // todo: XI
  }

  protected abstract _isValid(): boolean

  isValid(): boolean {
    const runTimeOptions = this.getNode().getRunTimeEnumOptions(this)
    if (runTimeOptions) return runTimeOptions.includes(this._word)
    return this._getCellTypeDefinition().isValid(this._word, this.getNode().getRootProgramNode()) && this._isValid()
  }

  getErrorIfAny(): jTreeTypes.TreeError {
    if (this._word !== undefined && this.isValid()) return undefined

    // todo: refactor invalidwordError. We want better error messages.
    return this._word === undefined ? new MissingWordError(this) : new InvalidWordError(this)
  }
}

class GrammarIntCell extends AbstractGrammarBackedCell<number> {
  _isValid() {
    const num = parseInt(this._word)
    if (isNaN(num)) return false
    return num.toString() === this._word
  }

  getRegexString() {
    return "\-?[0-9]+"
  }

  getParsed() {
    return parseInt(this._word)
  }

  static parserFunctionName = "parseInt"
}

class GrammarBitCell extends AbstractGrammarBackedCell<boolean> {
  _isValid() {
    const str = this._word
    return str === "0" || str === "1"
  }

  getRegexString() {
    return "[01]"
  }

  getParsed() {
    return !!parseInt(this._word)
  }
}

class GrammarFloatCell extends AbstractGrammarBackedCell<number> {
  _isValid() {
    const num = parseFloat(this._word)
    return !isNaN(num) && /^-?\d*(\.\d+)?$/.test(this._word)
  }

  getRegexString() {
    return "-?\d*(\.\d+)?"
  }

  getParsed() {
    return parseFloat(this._word)
  }

  static parserFunctionName = "parseFloat"
}

// ErrorCellType => grammar asks for a '' cell type here but the grammar does not specify a '' cell type. (todo: bring in didyoumean?)

class GrammarBoolCell extends AbstractGrammarBackedCell<boolean> {
  private _trues = new Set(["1", "true", "t", "yes"])
  private _falses = new Set(["0", "false", "f", "no"])

  _isValid() {
    const str = this._word.toLowerCase()
    return this._trues.has(str) || this._falses.has(str)
  }

  private _getOptions() {
    return Array.from(this._trues).concat(Array.from(this._falses))
  }

  getRegexString() {
    return "(?:" + this._getOptions().join("|") + ")"
  }

  getParsed() {
    return this._trues.has(this._word.toLowerCase())
  }
}

class GrammarAnyCell extends AbstractGrammarBackedCell<string> {
  _isValid() {
    return true
  }

  getRegexString() {
    return "[^ ]+"
  }

  getParsed() {
    return this._word
  }
}

class GrammarExtraWordCellTypeCell extends AbstractGrammarBackedCell<string> {
  _isValid() {
    return false
  }

  getParsed() {
    return this._word
  }

  getErrorIfAny(): jTreeTypes.TreeError {
    return new ExtraWordError(this)
  }
}

class GrammarUnknownCellTypeCell extends AbstractGrammarBackedCell<string> {
  _isValid() {
    return false
  }

  getParsed() {
    return this._word
  }

  getErrorIfAny(): jTreeTypes.TreeError {
    return new UnknownCellTypeError(this)
  }
}

abstract class AbstractTreeError implements jTreeTypes.TreeError {
  constructor(node: GrammarBackedNode) {
    this._node = node
  }
  private _node: GrammarBackedNode // todo: would it ever be a TreeNode?

  getLineIndex(): jTreeTypes.positiveInt {
    return this.getLineNumber() - 1
  }

  getLineNumber(): jTreeTypes.positiveInt {
    return this.getNode()._getLineNumber() // todo: handle sourcemaps
  }

  isCursorOnWord(lineIndex: jTreeTypes.positiveInt, characterIndex: jTreeTypes.positiveInt) {
    return lineIndex === this.getLineIndex() && this._doesCharacterIndexFallOnWord(characterIndex)
  }

  private _doesCharacterIndexFallOnWord(characterIndex: jTreeTypes.positiveInt) {
    return this.getCellIndex() === this.getNode().getWordIndexAtCharacterIndex(characterIndex)
  }

  // convenience method. may be removed.
  isBlankLineError() {
    return false
  }

  // convenience method. may be removed.
  isMissingWordError() {
    return false
  }

  getIndent() {
    return this.getNode().getIndentation()
  }

  getCodeMirrorLineWidgetElement(onApplySuggestionCallBack = () => {}) {
    const suggestion = this.getSuggestionMessage()
    if (this.isMissingWordError()) return this._getCodeMirrorLineWidgetElementCellTypeHints()
    if (suggestion) return this._getCodeMirrorLineWidgetElementWithSuggestion(onApplySuggestionCallBack, suggestion)
    return this._getCodeMirrorLineWidgetElementWithoutSuggestion()
  }

  private _getCodeMirrorLineWidgetElementCellTypeHints() {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + (<GrammarBackedNonRootNode>this.getNode()).getDefinition().getLineHints()))
    el.className = "LintCellTypeHints"
    return el
  }

  private _getCodeMirrorLineWidgetElementWithoutSuggestion() {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + this.getMessage()))
    el.className = "LintError"
    return el
  }

  private _getCodeMirrorLineWidgetElementWithSuggestion(onApplySuggestionCallBack: Function, suggestion: string) {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + `${this.getErrorTypeName()}. Suggestion: ${suggestion}`))
    el.className = "LintErrorWithSuggestion"
    el.onclick = () => {
      this.applySuggestion()
      onApplySuggestionCallBack()
    }
    return el
  }

  getLine() {
    return this.getNode().getLine()
  }

  getExtension() {
    return this.getNode()
      .getGrammarProgramRoot()
      .getExtensionName()
  }

  getNode() {
    return this._node
  }

  getErrorTypeName() {
    return this.constructor.name.replace("Error", "")
  }

  getCellIndex() {
    return 0
  }

  toObject() {
    return {
      type: this.getErrorTypeName(),
      line: this.getLineNumber(),
      cell: this.getCellIndex(),
      suggestion: this.getSuggestionMessage(),
      path: this.getNode().getFirstWordPath(),
      message: this.getMessage()
    }
  }

  hasSuggestion() {
    return this.getSuggestionMessage() !== ""
  }

  getSuggestionMessage() {
    return ""
  }

  toString() {
    return this.getMessage()
  }

  applySuggestion() {}

  getMessage(): string {
    return `${this.getErrorTypeName()} at line ${this.getLineNumber()} cell ${this.getCellIndex()}.`
  }
}

abstract class AbstractCellError extends AbstractTreeError {
  constructor(cell: AbstractGrammarBackedCell<any>) {
    super(cell.getNode())
    this._cell = cell
  }

  getCell() {
    return this._cell
  }

  getCellIndex() {
    return this._cell.getCellIndex()
  }

  protected _getWordSuggestion() {
    return TreeUtils.didYouMean(
      this.getCell().getWord(),
      this.getCell()
        .getAutoCompleteWords()
        .map(option => option.text)
    )
  }

  private _cell: AbstractGrammarBackedCell<any>
}

class UnknownNodeTypeError extends AbstractTreeError {
  getMessage(): string {
    const node = this.getNode()
    const parentNode = node.getParent()
    const options = Object.keys(parentNode.getFirstWordMap())
    return super.getMessage() + ` Invalid nodeType "${node.getFirstWord()}". Valid options are: "${options}"`
  }

  protected _getWordSuggestion() {
    const node = this.getNode()
    const parentNode = node.getParent()
    return TreeUtils.didYouMean(node.getFirstWord(), (<GrammarBackedNode>parentNode).getAutocompleteResults("", 0).map(option => option.text))
  }

  getSuggestionMessage() {
    const suggestion = this._getWordSuggestion()
    const node = this.getNode()

    if (suggestion) return `Change "${node.getFirstWord()}" to "${suggestion}"`

    return ""
  }

  applySuggestion() {
    const suggestion = this._getWordSuggestion()
    if (suggestion) this.getNode().setWord(this.getCellIndex(), suggestion)
    return this
  }
}

class BlankLineError extends UnknownNodeTypeError {
  getMessage(): string {
    return super.getMessage() + ` Line: "${this.getNode().getLine()}". Blank lines are errors.`
  }

  // convenience method
  isBlankLineError() {
    return true
  }

  getSuggestionMessage() {
    return `Delete line ${this.getLineNumber()}`
  }

  applySuggestion() {
    this.getNode().destroy()
    return this
  }
}

class MissingRequiredNodeTypeError extends AbstractTreeError {
  constructor(node: GrammarBackedNode, missingWord: jTreeTypes.firstWord) {
    super(node)
    this._missingWord = missingWord
  }

  getMessage(): string {
    return super.getMessage() + ` Missing required node "${this._missingWord}".`
  }

  getSuggestionMessage() {
    return `Insert "${this._missingWord}" on line ${this.getLineNumber() + 1}`
  }

  applySuggestion() {
    return this.getNode().prependLine(this._missingWord)
  }

  private _missingWord: string
}

class NodeTypeUsedMultipleTimesError extends AbstractTreeError {
  getMessage(): string {
    return super.getMessage() + ` Multiple "${this.getNode().getFirstWord()}" found.`
  }

  getSuggestionMessage() {
    return `Delete line ${this.getLineNumber()}`
  }

  applySuggestion() {
    return this.getNode().destroy()
  }
}

class UnknownCellTypeError extends AbstractCellError {
  getMessage(): string {
    return super.getMessage() + ` No cellType "${this.getCell().getCellTypeId()}" found. Language grammar for "${this.getExtension()}" may need to be fixed.`
  }
}

class InvalidWordError extends AbstractCellError {
  getMessage(): string {
    return super.getMessage() + ` "${this.getCell().getWord()}" does not fit in cellType "${this.getCell().getCellTypeId()}".`
  }

  getSuggestionMessage() {
    const suggestion = this._getWordSuggestion()

    if (suggestion) return `Change "${this.getCell().getWord()}" to "${suggestion}"`

    return ""
  }

  applySuggestion() {
    const suggestion = this._getWordSuggestion()
    if (suggestion) this.getNode().setWord(this.getCellIndex(), suggestion)
    return this
  }
}

class ExtraWordError extends AbstractCellError {
  getMessage(): string {
    return super.getMessage() + ` Extra word "${this.getCell().getWord()}".`
  }

  getSuggestionMessage() {
    return `Delete word "${this.getCell().getWord()}" at cell ${this.getCellIndex()}`
  }

  applySuggestion() {
    return this.getNode().deleteWordAt(this.getCellIndex())
  }
}

class MissingWordError extends AbstractCellError {
  // todo: autocomplete suggestion

  getMessage(): string {
    return super.getMessage() + ` Missing word for cell "${this.getCell().getCellTypeId()}".`
  }

  isMissingWordError() {
    return true
  }
}

// todo: add standard types, enum types, from disk types

abstract class AbstractGrammarWordTestNode extends TreeNode {
  abstract isValid(str: string, programRootNode?: GrammarBackedRootNode): boolean
}

class GrammarRegexTestNode extends AbstractGrammarWordTestNode {
  private _regex: RegExp

  isValid(str: string) {
    if (!this._regex) this._regex = new RegExp("^" + this.getContent() + "$")
    return !!str.match(this._regex)
  }
}

class GrammarReservedWordsTestNode extends AbstractGrammarWordTestNode {
  private _set: Set<string>

  isValid(str: string) {
    if (!this._set) this._set = new Set(this.getContent().split(" "))
    return !this._set.has(str)
  }
}

// todo: remove in favor of custom word type constructors
class EnumFromGrammarTestNode extends AbstractGrammarWordTestNode {
  _getEnumFromGrammar(programRootNode: GrammarBackedRootNode): jTreeTypes.stringMap {
    const nodeTypes = this.getWordsFrom(1)
    const enumGroup = nodeTypes.join(" ")
    // note: hack where we store it on the program. otherwise has global effects.
    if (!(<any>programRootNode)._enumMaps) (<any>programRootNode)._enumMaps = {}
    if ((<any>programRootNode)._enumMaps[enumGroup]) return (<any>programRootNode)._enumMaps[enumGroup]

    const wordIndex = 1
    const map: jTreeTypes.stringMap = {}
    programRootNode.findNodes(nodeTypes).forEach(node => {
      map[node.getWord(wordIndex)] = true
    })
    ;(<any>programRootNode)._enumMaps[enumGroup] = map
    return map
  }

  // todo: remove
  isValid(str: string, programRootNode: GrammarBackedRootNode) {
    return this._getEnumFromGrammar(programRootNode)[str] === true
  }
}

class GrammarEnumTestNode extends AbstractGrammarWordTestNode {
  private _map: jTreeTypes.stringMap

  isValid(str: string) {
    // enum c c++ java
    return !!this.getOptions()[str]
  }

  getOptions() {
    if (!this._map) this._map = TreeUtils.arrayToMap(this.getWordsFrom(1))
    return this._map
  }
}

abstract class AbstractExtendibleTreeNode extends TreeNode {
  _getFromExtended(firstWordPath: jTreeTypes.firstWordPath) {
    const hit = this._getNodeFromExtended(firstWordPath)
    return hit ? hit.get(firstWordPath) : undefined
  }

  // todo: be more specific with the param
  _getChildrenByNodeConstructorInExtended(constructor: Function): TreeNode[] {
    return (<any>this._getAncestorsArray().map(node => node.getChildrenByNodeConstructor(constructor))).flat()
  }

  _getExtendedParent() {
    return this._getAncestorsArray()[1]
  }

  _hasFromExtended(firstWordPath: jTreeTypes.firstWordPath) {
    return !!this._getNodeFromExtended(firstWordPath)
  }

  _getNodeFromExtended(firstWordPath: jTreeTypes.firstWordPath) {
    return this._getAncestorsArray().find(node => node.has(firstWordPath))
  }

  _doesExtend(nodeTypeId: jTreeTypes.nodeTypeId) {
    return this._getAncestorSet().has(nodeTypeId)
  }

  _getAncestorSet() {
    if (!this._cache_ancestorSet) this._cache_ancestorSet = new Set(this._getAncestorsArray().map(def => def._getId()))
    return this._cache_ancestorSet
  }

  _getId(): string {
    return this.getWord(1)
  }

  private _cache_ancestorSet: Set<jTreeTypes.nodeTypeId>
  private _cache_ancestorsArray: AbstractExtendibleTreeNode[]

  // Note: the order is: [this, parent, grandParent, ...]
  _getAncestorsArray(cannotContainNodes?: AbstractExtendibleTreeNode[]) {
    this._initAncestorsArrayCache(cannotContainNodes)
    return this._cache_ancestorsArray
  }

  private _getIdThatThisExtends() {
    return this.get(GrammarConstants.extends)
  }

  abstract _getIdToNodeMap(): { [id: string]: AbstractExtendibleTreeNode }

  protected _initAncestorsArrayCache(cannotContainNodes?: AbstractExtendibleTreeNode[]): void {
    if (this._cache_ancestorsArray) return undefined
    if (cannotContainNodes && cannotContainNodes.includes(this)) throw new Error(`Loop detected: '${this.getLine()}' is the ancestor of one of its ancestors.`)
    cannotContainNodes = cannotContainNodes || [this]
    let ancestors: AbstractExtendibleTreeNode[] = [this]
    const extendedId = this._getIdThatThisExtends()
    if (extendedId) {
      const parentNode = this._getIdToNodeMap()[extendedId]
      if (!parentNode) throw new Error(`${extendedId} not found`)

      ancestors = ancestors.concat(parentNode._getAncestorsArray(cannotContainNodes))
    }
    this._cache_ancestorsArray = ancestors
  }
}

class ExtendibleTreeNode extends AbstractExtendibleTreeNode {
  private _nodeMapCache: { [id: string]: AbstractExtendibleTreeNode }
  _getIdToNodeMap() {
    if (!this._nodeMapCache) {
      this._nodeMapCache = {}
      this.forEach(child => {
        this._nodeMapCache[child.getWord(1)] = child
      })
    }
    return this._nodeMapCache
  }
}

class GrammarCellTypeDefinitionNode extends AbstractExtendibleTreeNode {
  getFirstWordMap() {
    const types: jTreeTypes.stringMap = {}
    types[GrammarConstants.regex] = GrammarRegexTestNode
    types[GrammarConstants.reservedWords] = GrammarReservedWordsTestNode
    types[GrammarConstants.enumFromGrammar] = EnumFromGrammarTestNode
    types[GrammarConstants.enum] = GrammarEnumTestNode
    types[GrammarConstants.highlightScope] = TreeNode
    types[GrammarConstants.todoComment] = TreeNode
    types[GrammarConstants.extends] = TreeNode
    return types
  }

  _getIdToNodeMap() {
    return this._getRootProgramNode().getCellTypeDefinitions()
  }

  getGetter(wordIndex: number) {
    const wordToNativeJavascriptTypeParser = this.getCellConstructor().parserFunctionName
    return `get ${this.getCellTypeId()}() {
      return ${wordToNativeJavascriptTypeParser ? wordToNativeJavascriptTypeParser + `(this.getWord(${wordIndex}))` : `this.getWord(${wordIndex})`}
    }`
  }

  getCatchAllGetter(wordIndex: number) {
    const wordToNativeJavascriptTypeParser = this.getCellConstructor().parserFunctionName
    return `get ${this.getCellTypeId()}() {
      return ${
        wordToNativeJavascriptTypeParser
          ? `this.getWordsFrom(${wordIndex}).map(val => ${wordToNativeJavascriptTypeParser}(val))`
          : `this.getWordsFrom(${wordIndex})`
      }
    }`
  }

  // `this.getWordsFrom(${requireds.length + 1})`

  // todo: cleanup typings. todo: remove this hidden logic. have a "baseType" property?
  getCellConstructor(): typeof AbstractGrammarBackedCell {
    const kinds: jTreeTypes.stringMap = {}
    kinds[GrammarStandardCellTypeIds.any] = GrammarAnyCell
    kinds[GrammarStandardCellTypeIds.anyFirstWord] = GrammarAnyCell
    kinds[GrammarStandardCellTypeIds.float] = GrammarFloatCell
    kinds[GrammarStandardCellTypeIds.number] = GrammarFloatCell
    kinds[GrammarStandardCellTypeIds.bit] = GrammarBitCell
    kinds[GrammarStandardCellTypeIds.bool] = GrammarBoolCell
    kinds[GrammarStandardCellTypeIds.int] = GrammarIntCell
    return kinds[this.getWord(1)] || kinds[this._getExtendedCellTypeId()] || GrammarAnyCell
  }

  private _getExtendedCellTypeId() {
    return this.get(GrammarConstants.extends)
  }

  getHighlightScope(): string | undefined {
    return this._getFromExtended(GrammarConstants.highlightScope)
  }

  private _getEnumOptions() {
    const enumNode = this._getNodeFromExtended(GrammarConstants.enum)
    if (!enumNode) return undefined

    // we sort by longest first to capture longest match first. todo: add test
    const options = Object.keys((<GrammarEnumTestNode>enumNode.getNode(GrammarConstants.enum)).getOptions())
    options.sort((a, b) => b.length - a.length)

    return options
  }

  private _getEnumFromGrammarOptions(program: GrammarBackedRootNode) {
    const node = this._getNodeFromExtended(GrammarConstants.enumFromGrammar)
    return node ? Object.keys((<EnumFromGrammarTestNode>node.getNode(GrammarConstants.enumFromGrammar))._getEnumFromGrammar(program)) : undefined
  }

  _getRootProgramNode(): GrammarProgram {
    return <GrammarProgram>this.getParent()
  }

  _getAutocompleteWordOptions(program: GrammarBackedRootNode): string[] {
    return this._getEnumOptions() || this._getEnumFromGrammarOptions(program) || []
  }

  getRegexString() {
    // todo: enum
    const enumOptions = this._getEnumOptions()
    return this._getFromExtended(GrammarConstants.regex) || (enumOptions ? "(?:" + enumOptions.join("|") + ")" : "[^ ]*")
  }

  isValid(str: string, programRootNode: GrammarBackedRootNode) {
    return this._getChildrenByNodeConstructorInExtended(AbstractGrammarWordTestNode).every(node =>
      (<AbstractGrammarWordTestNode>node).isValid(str, programRootNode)
    )
  }

  getCellTypeId(): jTreeTypes.cellTypeId {
    return this.getWord(1)
  }

  public static types: any
}

class GrammarExampleNode extends TreeNode {}

class GrammarCompilerNode extends TreeNode {
  getFirstWordMap() {
    const types = [
      GrammarConstantsCompiler.stringTemplate,
      GrammarConstantsCompiler.indentCharacter,
      GrammarConstantsCompiler.catchAllCellDelimiter,
      GrammarConstantsCompiler.openChildren,
      GrammarConstantsCompiler.closeChildren
    ]
    const map: jTreeTypes.firstWordToNodeConstructorMap = {}
    types.forEach(type => {
      map[type] = TreeNode
    })
    return map
  }
}

abstract class GrammarNodeTypeConstant extends TreeNode {
  getGetter() {
    return `get ${this.getIdentifier()}() { return ${this.getConstantValueAsJsText()} }`
  }

  getIdentifier() {
    return this.getWord(1)
  }

  getConstantValueAsJsText() {
    const words = this.getWordsFrom(2)
    return words.length > 1 ? `[${words.join(",")}]` : words[0]
  }

  getConstantValue() {
    return JSON.parse(this.getConstantValueAsJsText())
  }
}

class GrammarNodeTypeConstantInt extends GrammarNodeTypeConstant {}
class GrammarNodeTypeConstantString extends GrammarNodeTypeConstant {
  getConstantValueAsJsText() {
    return "`" + TreeUtils.escapeBackTicks(this.getConstantValue()) + "`"
  }

  getConstantValue() {
    return this.length ? this.childrenToString() : this.getWordsFrom(2).join(" ")
  }
}
class GrammarNodeTypeConstantFloat extends GrammarNodeTypeConstant {}
class GrammarNodeTypeConstantBoolean extends GrammarNodeTypeConstant {}

abstract class AbstractGrammarDefinitionNode extends AbstractExtendibleTreeNode {
  getFirstWordMap(): jTreeTypes.firstWordToNodeConstructorMap {
    // todo: some of these should just be on nonRootNodes
    const types = [
      GrammarConstants.frequency,
      GrammarConstants.inScope,
      GrammarConstants.cells,
      GrammarConstants.extends,
      GrammarConstants.description,
      GrammarConstants.catchAllNodeType,
      GrammarConstants.catchAllCellType,
      GrammarConstants.firstCellType,
      GrammarConstants.extensions,
      GrammarConstants.version,
      GrammarConstants.tags,
      GrammarConstants.nodeTypeOrder,
      GrammarConstants.match,
      GrammarConstants.baseNodeType,
      GrammarConstants.required,
      GrammarConstants.root,
      GrammarConstants.compilesTo,
      GrammarConstants.abstract,
      GrammarConstants.javascript,
      GrammarConstants.single,
      GrammarConstants.todoComment
    ]

    const map: jTreeTypes.firstWordToNodeConstructorMap = {}
    types.forEach(type => {
      map[type] = TreeNode
    })
    map[GrammarConstantsConstantTypes.boolean] = GrammarNodeTypeConstantBoolean
    map[GrammarConstantsConstantTypes.int] = GrammarNodeTypeConstantInt
    map[GrammarConstantsConstantTypes.string] = GrammarNodeTypeConstantString
    map[GrammarConstantsConstantTypes.float] = GrammarNodeTypeConstantFloat
    map[GrammarConstants.compilerNodeType] = GrammarCompilerNode
    map[GrammarConstants.example] = GrammarExampleNode
    return map
  }

  getConstantsObject() {
    const obj = this._getUniqueConstantNodes()
    Object.keys(obj).forEach(key => {
      obj[key] = obj[key].getConstantValue()
    })
    return obj
  }

  _getUniqueConstantNodes(extended = true) {
    const obj: { [key: string]: GrammarNodeTypeConstant } = {}
    const items = extended ? this._getChildrenByNodeConstructorInExtended(GrammarNodeTypeConstant) : this.getChildrenByNodeConstructor(GrammarNodeTypeConstant)
    items.reverse() // Last definition wins.
    items.forEach((node: GrammarNodeTypeConstant) => {
      obj[node.getIdentifier()] = node
    })
    return obj
  }

  getExamples(): GrammarExampleNode[] {
    return this._getChildrenByNodeConstructorInExtended(GrammarExampleNode)
  }

  getNodeTypeIdFromDefinition(): jTreeTypes.nodeTypeId {
    return this.getWord(1)
  }

  // todo: remove. just reused nodeTypeId
  _getGeneratedClassName() {
    return this.getNodeTypeIdFromDefinition()
  }

  _isAbstract() {
    return this.has(GrammarConstants.abstract)
  }

  private _cache_definedNodeConstructor: jTreeTypes.RunTimeNodeConstructor

  _getConstructorDefinedInGrammar() {
    if (!this._cache_definedNodeConstructor)
      this._cache_definedNodeConstructor = this.getLanguageDefinitionProgram()._getCompiledLoadedNodeTypes()[this.getNodeTypeIdFromDefinition()]
    return this._cache_definedNodeConstructor
  }

  _getFirstWordMatch() {
    return this.get(GrammarConstants.match) || this.getNodeTypeIdFromDefinition()
  }

  getLanguageDefinitionProgram(): GrammarProgram {
    return <GrammarProgram>this.getParent()
  }

  protected _getCustomJavascriptMethods(): jTreeTypes.javascriptCode {
    const hasJsCode = this.has(GrammarConstants.javascript)
    return hasJsCode ? this.getNode(GrammarConstants.javascript).childrenToString() : ""
  }

  private _cache_firstWordToNodeDefMap: { [firstWord: string]: NonRootNodeTypeDefinition }

  getFirstWordMapWithDefinitions() {
    if (!this._cache_firstWordToNodeDefMap) this._cache_firstWordToNodeDefMap = this._createFirstWordToNodeDefMap(this._getInScopeNodeTypeIds())
    return this._cache_firstWordToNodeDefMap
  }

  getRunTimeFirstWordsInScope(): jTreeTypes.nodeTypeId[] {
    return Object.keys(this.getFirstWordMap())
  }

  getRequiredCellTypeIds(): jTreeTypes.cellTypeId[] {
    const parameters = this._getFromExtended(GrammarConstants.cells)
    return parameters ? parameters.split(" ") : []
  }

  // todo: what happens when you have a cell getter and constant with same name?
  _getCellGettersAndNodeTypeConstants() {
    // todo: add cellType parsings
    const grammarProgram = this.getLanguageDefinitionProgram()
    const requiredCells = this.get(GrammarConstants.cells)
    const getters = (requiredCells ? requiredCells.split(" ") : []).map((cellTypeId, index) =>
      grammarProgram.getCellTypeDefinitionById(cellTypeId).getGetter(index + 1)
    )

    const catchAllCellTypeId = this.get(GrammarConstants.catchAllCellType)
    if (catchAllCellTypeId) getters.push(grammarProgram.getCellTypeDefinitionById(catchAllCellTypeId).getCatchAllGetter(getters.length + 1))

    // Constants
    Object.values(this._getUniqueConstantNodes(false)).forEach(node => {
      getters.push(node.getGetter())
    })

    return getters.join("\n")
  }

  getCatchAllCellTypeId(): jTreeTypes.cellTypeId | undefined {
    return this._getFromExtended(GrammarConstants.catchAllCellType)
  }

  protected _createFirstWordToNodeDefMap(nodeTypeIdsInScope: jTreeTypes.nodeTypeId[]): { [firstWord: string]: NonRootNodeTypeDefinition } {
    if (!nodeTypeIdsInScope.length) return {}

    const result: { [firstWord: string]: NonRootNodeTypeDefinition } = {}

    const allProgramNodeTypeDefinitionsMap = this._getProgramNodeTypeDefinitionCache()
    Object.keys(allProgramNodeTypeDefinitionsMap)
      .filter(nodeTypeId => allProgramNodeTypeDefinitionsMap[nodeTypeId].isOrExtendsANodeTypeInScope(nodeTypeIdsInScope))
      .filter(nodeTypeId => !allProgramNodeTypeDefinitionsMap[nodeTypeId]._isAbstract())
      .forEach(nodeTypeId => {
        const def = allProgramNodeTypeDefinitionsMap[nodeTypeId]
        result[def._getFirstWordMatch()] = def
      })
    return result
  }

  // todo: update to better reflect _getFirstWordMatch?
  getTopNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    const arr = Object.values(this.getFirstWordMapWithDefinitions())
    arr.sort(TreeUtils.sortByAccessor((definition: NonRootNodeTypeDefinition) => definition.getFrequency()))
    arr.reverse()
    return arr.map(definition => definition.getNodeTypeIdFromDefinition())
  }

  protected _getMyInScopeNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    const nodeTypesNode = this.getNode(GrammarConstants.inScope)
    return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : []
  }

  protected _getInScopeNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    // todo: allow multiple of these if we allow mixins?
    const ids = this._getMyInScopeNodeTypeIds()
    const parentDef = this._getExtendedParent()
    return parentDef ? ids.concat((<AbstractGrammarDefinitionNode>parentDef)._getInScopeNodeTypeIds()) : ids
  }

  isRequired(): boolean {
    return this._hasFromExtended(GrammarConstants.required)
  }

  getNodeTypeDefinitionByNodeTypeId(nodeTypeId: jTreeTypes.nodeTypeId): AbstractGrammarDefinitionNode {
    // todo: return catch all?
    return this._getProgramNodeTypeDefinitionCache()[nodeTypeId]
  }

  getFirstCellTypeId(): jTreeTypes.cellTypeId {
    return this._getFromExtended(GrammarConstants.firstCellType) || GrammarStandardCellTypeIds.anyFirstWord
  }

  isDefined(nodeTypeId: string) {
    return !!this._getProgramNodeTypeDefinitionCache()[nodeTypeId.toLowerCase()]
  }

  _getIdToNodeMap() {
    return this._getProgramNodeTypeDefinitionCache()
  }

  private _cache_isRoot: boolean

  private _amIRoot(): boolean {
    if (this._cache_isRoot === undefined) this._cache_isRoot = this._getLanguageRootNode() === this
    return this._cache_isRoot
  }

  private _getLanguageRootNode() {
    return (<GrammarProgram>this.getParent())._getRootNodeTypeDefinitionNode()
  }

  private _isErrorNodeType() {
    return this.get(GrammarConstants.baseNodeType) === GrammarConstants.errorNode
  }

  private _isBlobNodeType() {
    // Do not check extended classes. Only do once.
    return this.get(GrammarConstants.baseNodeType) === GrammarConstants.blobNode
  }

  private _getErrorMethodToJavascript(): jTreeTypes.javascriptCode {
    if (this._isBlobNodeType()) return "getErrors() { return [] }" // Skips parsing child nodes for perf gains.
    if (this._isErrorNodeType()) return "getErrors() { return this._getErrorNodeErrors() }"
    return ""
  }

  private _getParserToJavascript(): jTreeTypes.javascriptCode {
    if (this._isBlobNodeType())
      // todo: do we need this?
      return "getFirstWordMap() { return {} }"
    const myFirstWordMap = this._createFirstWordToNodeDefMap(this._getMyInScopeNodeTypeIds())

    // todo: use constants in first word maps?
    // todo: cache the super extending?
    if (Object.keys(myFirstWordMap).length)
      return `getFirstWordMap() {
        const map = Object.assign({}, super.getFirstWordMap())
  return Object.assign(map, {${Object.keys(myFirstWordMap)
    .map(firstWord => `"${firstWord}" : ${myFirstWordMap[firstWord].getNodeTypeIdFromDefinition()}`)
    .join(",\n")}})
  }`
    return ""
  }

  private _getCatchAllNodeConstructorToJavascript(): jTreeTypes.javascriptCode {
    if (this._isBlobNodeType()) return "getCatchAllNodeConstructor() { return this._getBlobNodeCatchAllNodeType() }"
    const nodeTypeId = this.get(GrammarConstants.catchAllNodeType)
    if (!nodeTypeId) return ""
    const className = this.getNodeTypeDefinitionByNodeTypeId(nodeTypeId)._getGeneratedClassName()
    return `getCatchAllNodeConstructor() { return ${className}}`
  }

  _nodeDefToJavascriptClass(): jTreeTypes.javascriptCode {
    const components = [
      this._getParserToJavascript(),
      this._getErrorMethodToJavascript(),
      this._getCatchAllNodeConstructorToJavascript(),
      this._getCellGettersAndNodeTypeConstants(),
      this._getCustomJavascriptMethods()
    ].filter(code => code)

    const isRoot = this._amIRoot()

    const extendedDef = <AbstractGrammarDefinitionNode>this._getExtendedParent()
    const extendsClassName = isRoot ? "jtree.GrammarBackedRootNode" : extendedDef ? extendedDef._getGeneratedClassName() : "jtree.GrammarBackedNonRootNode"

    if (isRoot) {
      components.push(`getGrammarProgramRoot() {
        if (!this._cachedGrammarProgramRoot)
          this._cachedGrammarProgramRoot = new jtree.GrammarProgram(\`${TreeUtils.escapeBackTicks(
            this.getParent()
              .toString()
              .replace(/\\/g, "\\\\")
          )}\`)
        return this._cachedGrammarProgramRoot
      }`)
      const defs = this.getLanguageDefinitionProgram().getConcreteAndAbstractNodeTypeDefinitions()

      const nodeTypeMap = defs
        .map(def => {
          const id = def.getNodeTypeIdFromDefinition()
          return `"${id}": ${id}`
        })
        .join(",\n")

      components.push(`static getNodeTypeMap() { return {${nodeTypeMap} }}`)
    }

    return `class ${this._getGeneratedClassName()} extends ${extendsClassName} {
      ${components.join("\n")}
    }`
  }

  _getCompilerObject(): jTreeTypes.stringMap {
    let obj: { [key: string]: string } = {}
    const items = this._getChildrenByNodeConstructorInExtended(GrammarCompilerNode)
    items.reverse() // Last definition wins.
    items.forEach((node: GrammarCompilerNode) => {
      obj = Object.assign(obj, node.toObject()) // todo: what about multiline strings?
    })
    return obj
  }

  // todo: improve layout (use bold?)
  getLineHints(): string {
    const catchAllCellTypeId = this.getCatchAllCellTypeId()
    return `${this._getFirstWordMatch()}: ${this.getRequiredCellTypeIds().join(" ")}${catchAllCellTypeId ? ` ${catchAllCellTypeId}...` : ""}`
  }

  isOrExtendsANodeTypeInScope(firstWordsInScope: string[]): boolean {
    const chain = this._getNodeTypeInheritanceSet()
    return firstWordsInScope.some(firstWord => chain.has(firstWord))
  }

  isTerminalNodeType() {
    return !this._getFromExtended(GrammarConstants.inScope) && !this._getFromExtended(GrammarConstants.catchAllNodeType)
  }

  private _getFirstCellHighlightScope() {
    const program = this.getLanguageDefinitionProgram()
    const cellTypeDefinition = program.getCellTypeDefinitionById(this.getFirstCellTypeId())
    // todo: standardize error/capture error at grammar time
    if (!cellTypeDefinition) throw new Error(`No ${GrammarConstants.cellType} ${this.getFirstCellTypeId()} found`)
    return cellTypeDefinition.getHighlightScope()
  }

  getMatchBlock() {
    const defaultHighlightScope = "source"
    const program = this.getLanguageDefinitionProgram()
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const firstWordHighlightScope = (this._getFirstCellHighlightScope() || defaultHighlightScope) + "." + this.getNodeTypeIdFromDefinition()
    const match = `'^ *${escapeRegExp(this._getFirstWordMatch())}(?: |$)'`
    const topHalf = ` '${this.getNodeTypeIdFromDefinition()}':
  - match: ${match}
    scope: ${firstWordHighlightScope}`
    const requiredCellTypeIds = this.getRequiredCellTypeIds()
    const catchAllCellTypeId = this.getCatchAllCellTypeId()
    if (catchAllCellTypeId) requiredCellTypeIds.push(catchAllCellTypeId)
    if (!requiredCellTypeIds.length) return topHalf
    const captures = requiredCellTypeIds
      .map((cellTypeId, index) => {
        const cellTypeDefinition = program.getCellTypeDefinitionById(cellTypeId) // todo: cleanup
        if (!cellTypeDefinition) throw new Error(`No ${GrammarConstants.cellType} ${cellTypeId} found`) // todo: standardize error/capture error at grammar time
        return `        ${index + 1}: ${(cellTypeDefinition.getHighlightScope() || defaultHighlightScope) + "." + cellTypeDefinition.getCellTypeId()}`
      })
      .join("\n")

    const cellTypesToRegex = (cellTypeIds: string[]) => cellTypeIds.map((cellTypeId: string) => `({{${cellTypeId}}})?`).join(" ?")

    return `${topHalf}
    push:
     - match: ${cellTypesToRegex(requiredCellTypeIds)}
       captures:
${captures}
     - match: $
       pop: true`
  }

  private _cache_nodeTypeInheritanceSet: Set<jTreeTypes.nodeTypeId>
  private _cache_ancestorNodeTypeIdsArray: jTreeTypes.nodeTypeId[]

  _getNodeTypeInheritanceSet() {
    if (!this._cache_nodeTypeInheritanceSet) this._cache_nodeTypeInheritanceSet = new Set(this.getAncestorNodeTypeIdsArray())
    return this._cache_nodeTypeInheritanceSet
  }

  getAncestorNodeTypeIdsArray(): jTreeTypes.nodeTypeId[] {
    if (!this._cache_ancestorNodeTypeIdsArray) {
      this._cache_ancestorNodeTypeIdsArray = this._getAncestorsArray().map(def => (<AbstractGrammarDefinitionNode>def).getNodeTypeIdFromDefinition())
      this._cache_ancestorNodeTypeIdsArray.reverse()
    }
    return this._cache_ancestorNodeTypeIdsArray
  }

  protected _getProgramNodeTypeDefinitionCache(): { [nodeTypeId: string]: NonRootNodeTypeDefinition } {
    return this.getLanguageDefinitionProgram()._getProgramNodeTypeDefinitionCache()
  }

  getDescription(): string {
    return this._getFromExtended(GrammarConstants.description) || ""
  }

  getFrequency() {
    const val = this._getFromExtended(GrammarConstants.frequency)
    return val ? parseFloat(val) : 0
  }

  private _getExtendedNodeTypeId(): jTreeTypes.nodeTypeId {
    const ancestorIds = this.getAncestorNodeTypeIdsArray()
    if (ancestorIds.length > 1) return ancestorIds[ancestorIds.length - 2]
  }
}

// todo: remove?
class NonRootNodeTypeDefinition extends AbstractGrammarDefinitionNode {}

// GrammarProgram is a constructor that takes a grammar file, and builds a new
// constructor for new language that takes files in that language to execute, compile, etc.
class GrammarProgram extends AbstractGrammarDefinitionNode {
  getFirstWordMap() {
    const map: jTreeTypes.stringMap = {}
    map[GrammarConstants.cellType] = GrammarCellTypeDefinitionNode
    map[GrammarConstants.nodeType] = NonRootNodeTypeDefinition
    map[GrammarConstants.toolingDirective] = TreeNode
    map[GrammarConstants.todoComment] = TreeNode
    return map
  }

  private _cache_compiledLoadedNodeTypes: { [nodeTypeId: string]: Function }

  _getCompiledLoadedNodeTypes() {
    if (!this._cache_compiledLoadedNodeTypes) {
      if (this.isNodeJs()) {
        const code = this.toNodeJsJavascript(__dirname + "/../index.js")
        const rootNode = this._importNodeJsRootNodeTypeConstructor(code)
        this._cache_compiledLoadedNodeTypes = rootNode.getNodeTypeMap()
      } else
        this._cache_compiledLoadedNodeTypes = this._importBrowserRootNodeTypeConstructor(this.toBrowserJavascript(), this.getGrammarName()).getNodeTypeMap()
    }
    return this._cache_compiledLoadedNodeTypes
  }

  private _importNodeJsRootNodeTypeConstructor(code: jTreeTypes.javascriptCode): any {
    const vm = require("vm")
    // todo: cleanup up
    try {
      ;(<any>global).jtree = require(__dirname + "/../index.js").default
      ;(<any>global).require = require
      ;(<any>global).module = {}
      return vm.runInThisContext(code)
    } catch (err) {
      console.log(`Error in compiled grammar code for language "${this.getGrammarName()}":`)
      console.log(
        code
          .split("\n")
          .map((line, index) => index + 1 + " " + line)
          .join("\n")
      )
      console.log(err)
      throw err
    }
  }

  private _importBrowserRootNodeTypeConstructor(code: jTreeTypes.javascriptCode, name: string): any {
    const script = document.createElement("script")
    script.innerHTML = code
    document.head.appendChild(script)
    return (<any>window)[name]
  }

  // todo: better formalize the source maps pattern somewhat used here by getAllErrors
  getErrorsInGrammarExamples() {
    const programConstructor = this.getRootConstructor()
    const errors: jTreeTypes.TreeError[] = []
    this.getConcreteAndAbstractNodeTypeDefinitions().forEach(def =>
      def.getExamples().forEach(example => {
        const exampleProgram = new programConstructor(example.childrenToString())
        exampleProgram.getAllErrors(example._getLineNumber() + 1).forEach(err => {
          errors.push(err)
        })
      })
    )
    return errors
  }

  getTargetExtension() {
    return this._getRootNodeTypeDefinitionNode().get(GrammarConstants.compilesTo)
  }

  getNodeTypeOrder() {
    return this._getRootNodeTypeDefinitionNode().get(GrammarConstants.nodeTypeOrder)
  }

  private _cache_cellTypes: {
    [name: string]: GrammarCellTypeDefinitionNode
  }

  getCellTypeDefinitions() {
    if (!this._cache_cellTypes) this._cache_cellTypes = this._getCellTypeDefinitions()
    return this._cache_cellTypes
  }

  getCellTypeDefinitionById(cellTypeId: jTreeTypes.cellTypeId) {
    // todo: return unknownCellTypeDefinition? or is that handled somewhere else?
    return this.getCellTypeDefinitions()[cellTypeId]
  }

  getNodeTypeFamilyTree() {
    const tree = new TreeNode()
    Object.values(this.getConcreteAndAbstractNodeTypeDefinitions()).forEach(node => {
      const path = node.getAncestorNodeTypeIdsArray().join(" ")
      tree.touchNode(path)
    })
    return tree
  }

  protected _getCellTypeDefinitions() {
    const types: { [typeName: string]: GrammarCellTypeDefinitionNode } = {}
    // todo: add built in word types?
    this.getChildrenByNodeConstructor(GrammarCellTypeDefinitionNode).forEach(type => (types[(<GrammarCellTypeDefinitionNode>type).getCellTypeId()] = type))
    return types
  }

  getLanguageDefinitionProgram() {
    return this
  }

  getConcreteAndAbstractNodeTypeDefinitions() {
    return <NonRootNodeTypeDefinition[]>this.getChildrenByNodeConstructor(NonRootNodeTypeDefinition)
  }

  private _cache_rootNodeTypeNode: NonRootNodeTypeDefinition

  _getRootNodeTypeDefinitionNode() {
    if (!this._cache_rootNodeTypeNode) {
      this.forEach(def => {
        if (def.has(GrammarConstants.root)) this._cache_rootNodeTypeNode = def
      })
    }
    return this._cache_rootNodeTypeNode
  }

  getExtensionName() {
    return this.getGrammarName()
  }

  getGrammarName(): string | undefined {
    return this._getRootNodeTypeDefinitionNode().getNodeTypeIdFromDefinition()
  }

  protected _getMyInScopeNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    const nodeTypesNode = this._getRootNodeTypeDefinitionNode().getNode(GrammarConstants.inScope)
    return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : []
  }

  protected _getInScopeNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    const nodeTypesNode = this._getRootNodeTypeDefinitionNode().getNode(GrammarConstants.inScope)
    return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : []
  }

  // At present we only have global nodeType definitions (you cannot have scoped nodeType definitions right now).
  private _cache_nodeTypeDefinitions: { [nodeTypeId: string]: NonRootNodeTypeDefinition }

  protected _initProgramNodeTypeDefinitionCache(): void {
    if (this._cache_nodeTypeDefinitions) return undefined

    this._cache_nodeTypeDefinitions = {}

    this.getChildrenByNodeConstructor(NonRootNodeTypeDefinition).forEach(nodeTypeDefinitionNode => {
      this._cache_nodeTypeDefinitions[(<NonRootNodeTypeDefinition>nodeTypeDefinitionNode).getNodeTypeIdFromDefinition()] = nodeTypeDefinitionNode
    })
  }

  _getProgramNodeTypeDefinitionCache() {
    this._initProgramNodeTypeDefinitionCache()
    return this._cache_nodeTypeDefinitions
  }

  static _languages: any = {}
  static _nodeTypes: any = {}

  private _getRootConstructor(): AbstractRuntimeProgramConstructorInterface {
    const def = this._getRootNodeTypeDefinitionNode()
    return <AbstractRuntimeProgramConstructorInterface>def._getConstructorDefinedInGrammar()
  }

  private _cache_rootConstructorClass: AbstractRuntimeProgramConstructorInterface

  getRootConstructor() {
    if (!this._cache_rootConstructorClass) this._cache_rootConstructorClass = this._getRootConstructor()
    return this._cache_rootConstructorClass
  }

  private _getFileExtensions(): string {
    return this._getRootNodeTypeDefinitionNode().get(GrammarConstants.extensions)
      ? this._getRootNodeTypeDefinitionNode()
          .get(GrammarConstants.extensions)
          .split(" ")
          .join(",")
      : this.getExtensionName()
  }

  toNodeJsJavascript(jtreePath = "jtree"): jTreeTypes.javascriptCode {
    return this._rootNodeDefToJavascriptClass(jtreePath, true).trim()
  }

  toBrowserJavascript(): jTreeTypes.javascriptCode {
    return this._rootNodeDefToJavascriptClass("", false).trim()
  }

  private _getProperName() {
    return TreeUtils.ucfirst(this.getExtensionName())
  }

  private _rootNodeDefToJavascriptClass(jtreePath: string, forNodeJs = true): jTreeTypes.javascriptCode {
    const defs = this.getConcreteAndAbstractNodeTypeDefinitions()
    // todo: throw if there is no root node defined
    const rootNode = this._getRootNodeTypeDefinitionNode()
    const nodeTypeClasses = defs.map(def => def._nodeDefToJavascriptClass()).join("\n\n")
    const rootName = rootNode._getGeneratedClassName()

    let exportScript = ""
    if (forNodeJs) {
      exportScript = `module.exports = ${rootName};
${rootName}`
    } else {
      exportScript = `window.${rootName} = ${rootName}`
    }

    // todo: we can expose the previous "constants" export, if needed, via the grammar, which we preserve.
    return `{
"use strict";

${forNodeJs ? `const jtree = require("${jtreePath}")` : ""}

${nodeTypeClasses}

${exportScript}
}
`
  }

  toSublimeSyntaxFile() {
    const cellTypeDefs = this.getCellTypeDefinitions()
    const variables = Object.keys(cellTypeDefs)
      .map(name => ` ${name}: '${cellTypeDefs[name].getRegexString()}'`)
      .join("\n")

    const defs = this.getConcreteAndAbstractNodeTypeDefinitions().filter(kw => !kw._isAbstract())
    const nodeTypeContexts = defs.map(def => def.getMatchBlock()).join("\n\n")
    const includes = defs.map(nodeTypeDef => `  - include: '${nodeTypeDef.getNodeTypeIdFromDefinition()}'`).join("\n")

    return `%YAML 1.2
---
name: ${this.getExtensionName()}
file_extensions: [${this._getFileExtensions()}]
scope: source.${this.getExtensionName()}

variables:
${variables}

contexts:
 main:
${includes}

${nodeTypeContexts}`
  }

  // A language where anything goes.
  // todo: can we remove? can we make the default language not require any grammar node?
  static getTheAnyLanguageRootConstructor() {
    return new GrammarProgram(
      `${GrammarConstants.nodeType} anyLanguage
 ${GrammarConstants.root}
 ${GrammarConstants.catchAllNodeType} anyNode
${GrammarConstants.nodeType} anyNode
 ${GrammarConstants.catchAllCellType} anyWord
 ${GrammarConstants.firstCellType} anyWord
${GrammarConstants.cellType} anyWord`
    ).getRootConstructor()
  }
}

export { GrammarConstants, GrammarStandardCellTypeIds, GrammarProgram, GrammarBackedRootNode, GrammarBackedNonRootNode }
