const { Utils } = require("../products/Utils.js")
const { Particle, ParticleWord, ExtendibleParticle, AbstractExtendibleParticle } = require("../products/Particle.js")

import { particlesTypes } from "../products/particlesTypes"

interface AbstractRuntimeProgramConstructorInterface {
  new (code?: string): ParserBackedParticle
}

declare type parserInfo = { firstWordMap: { [firstWord: string]: parserDefinitionParser }; regexTests: particlesTypes.regexTestDef[] }

// Compiled language parsers will include these files:
const GlobalNamespaceAdditions: particlesTypes.stringMap = {
  Utils: "Utils.js",
  Particle: "Particle.js",
  HandParsersProgram: "Parsers.js",
  ParserBackedParticle: "Parsers.js"
}

interface SimplePredictionModel {
  matrix: particlesTypes.int[][]
  idToIndex: { [id: string]: particlesTypes.int }
  indexToId: { [index: number]: string }
}

enum ParsersConstantsCompiler {
  stringTemplate = "stringTemplate", // replacement instructions
  indentCharacter = "indentCharacter",
  catchAllCellDelimiter = "catchAllCellDelimiter",
  openChildren = "openChildren",
  joinChildrenWith = "joinChildrenWith",
  closeChildren = "closeChildren"
}

enum ParsersConstantsMisc {
  doNotSynthesize = "doNotSynthesize"
}

enum PreludeCellTypeIds {
  anyCell = "anyCell",
  keywordCell = "keywordCell",
  extraWordCell = "extraWordCell",
  floatCell = "floatCell",
  numberCell = "numberCell",
  bitCell = "bitCell",
  boolCell = "boolCell",
  intCell = "intCell"
}

enum ParsersConstantsConstantTypes {
  boolean = "boolean",
  string = "string",
  int = "int",
  float = "float"
}

enum ParsersBundleFiles {
  package = "package.json",
  readme = "readme.md",
  indexHtml = "index.html",
  indexJs = "index.js",
  testJs = "test.js"
}

enum ParsersCellParser {
  prefix = "prefix",
  postfix = "postfix",
  omnifix = "omnifix"
}

enum ParsersConstants {
  // particle types
  extensions = "extensions",
  comment = "//",
  parser = "parser",
  cellType = "cellType",

  parsersFileExtension = "parsers",

  abstractParserPrefix = "abstract",
  parserSuffix = "Parser",
  cellTypeSuffix = "Cell",

  // error check time
  regex = "regex", // temporary?
  reservedWords = "reservedWords", // temporary?
  enumFromCellTypes = "enumFromCellTypes", // temporary?
  enum = "enum", // temporary?
  examples = "examples",
  min = "min",
  max = "max",

  // baseParsers
  baseParser = "baseParser",
  blobParser = "blobParser",
  errorParser = "errorParser",

  // parse time
  extends = "extends",
  root = "root",
  crux = "crux",
  cruxFromId = "cruxFromId",
  pattern = "pattern",
  inScope = "inScope",
  cells = "cells",
  listDelimiter = "listDelimiter",
  contentKey = "contentKey",
  childrenKey = "childrenKey",
  uniqueFirstWord = "uniqueFirstWord",
  catchAllCellType = "catchAllCellType",
  cellParser = "cellParser",
  catchAllParser = "catchAllParser",
  constants = "constants",
  required = "required", // Require this parser to be present in a particle or program
  single = "single", // Have at most 1 of these
  uniqueLine = "uniqueLine", // Can't have duplicate lines.
  tags = "tags",

  _rootNodeJsHeader = "_rootNodeJsHeader", // todo: remove

  // default catchAll parser
  BlobParser = "BlobParser",
  DefaultRootParser = "DefaultRootParser",

  // code
  javascript = "javascript",

  // compile time
  compilerParser = "compiler",
  compilesTo = "compilesTo",

  // develop time
  description = "description",
  example = "example",
  popularity = "popularity", // todo: remove. switch to conditional frequencies. potentially do that outside this core lang.
  paint = "paint"
}

class TypedWord extends ParticleWord {
  private _type: string
  constructor(particle: Particle, cellIndex: number, type: string) {
    super(particle, cellIndex)
    this._type = type
  }
  get type() {
    return this._type
  }
  toString() {
    return this.word + ":" + this.type
  }
}

// todo: can we merge these methods into base Particle and ditch this class?
abstract class ParserBackedParticle extends Particle {
  private _definition: AbstractParserDefinitionParser | HandParsersProgram | parserDefinitionParser
  get definition(): AbstractParserDefinitionParser | HandParsersProgram | parserDefinitionParser {
    if (this._definition) return this._definition

    this._definition = this.isRoot() ? this.handParsersProgram : this.parent.definition.getParserDefinitionByParserId(this.constructor.name)
    return this._definition
  }

  get rootParsersParticles() {
    return this.definition.root
  }

  getAutocompleteResults(partialWord: string, cellIndex: particlesTypes.positiveInt) {
    return cellIndex === 0 ? this._getAutocompleteResultsForFirstWord(partialWord) : this._getAutocompleteResultsForCell(partialWord, cellIndex)
  }

  makeError(message: string) {
    return new ParserDefinedError(this, message)
  }

  private _particleIndex: {
    [parserId: string]: ParserBackedParticle[]
  }

  protected get particleIndex() {
    // StringMap<int> {firstWord: index}
    // When there are multiple tails with the same firstWord, _index stores the last content.
    // todo: change the above behavior: when a collision occurs, create an array.
    return this._particleIndex || this._makeParticleIndex()
  }

  _clearIndex() {
    delete this._particleIndex
    return super._clearIndex()
  }

  protected _makeIndex(startAt = 0) {
    if (this._particleIndex) this._makeParticleIndex(startAt)
    return super._makeIndex(startAt)
  }

  protected _makeParticleIndex(startAt = 0) {
    if (!this._particleIndex || !startAt) this._particleIndex = {}
    const particles = this._getChildrenArray() as ParserBackedParticle[]
    const newIndex = this._particleIndex
    const length = particles.length

    for (let index = startAt; index < length; index++) {
      const particle = particles[index]
      const ancestors = Array.from(particle.definition._getAncestorSet()).forEach(id => {
        if (!newIndex[id]) newIndex[id] = []
        newIndex[id].push(particle)
      })
    }

    return newIndex
  }

  getChildInstancesOfParserId(parserId: particlesTypes.parserId): ParserBackedParticle[] {
    return this.particleIndex[parserId] || []
  }

  doesExtend(parserId: particlesTypes.parserId) {
    return this.definition._doesExtend(parserId)
  }

  _getErrorParserErrors() {
    return [this.firstWord ? new UnknownParserError(this) : new BlankLineError(this)]
  }

  _getBlobParserCatchAllParser() {
    return BlobParser
  }

  private _getAutocompleteResultsForFirstWord(partialWord: string) {
    const keywordMap = this.definition.firstWordMapWithDefinitions
    let keywords: string[] = Object.keys(keywordMap)

    if (partialWord) keywords = keywords.filter(keyword => keyword.includes(partialWord))

    return keywords
      .map(keyword => {
        const def = keywordMap[keyword]
        if (def.suggestInAutocomplete === false) return false
        const description = def.description
        return {
          text: keyword,
          displayText: keyword + (description ? " " + description : "")
        }
      })
      .filter(i => i)
  }

  private _getAutocompleteResultsForCell(partialWord: string, cellIndex: particlesTypes.positiveInt) {
    // todo: root should be [] correct?
    const cell = this.parsedCells[cellIndex]
    return cell ? cell.getAutoCompleteWords(partialWord) : []
  }

  // note: this is overwritten by the root particle of a runtime parsers program.
  // some of the magic that makes this all work. but maybe there's a better way.
  get handParsersProgram(): HandParsersProgram {
    if (this.isRoot()) throw new Error(`Root particle without getHandParsersProgram defined.`)
    return (<any>this.root).handParsersProgram
  }

  getRunTimeEnumOptions(cell: AbstractParsersBackedCell<any>): string[] {
    return undefined
  }

  getRunTimeEnumOptionsForValidation(cell: AbstractParsersBackedCell<any>): string[] {
    return this.getRunTimeEnumOptions(cell)
  }

  private _sortParticlesByInScopeOrder() {
    const parserOrder = this.definition._getMyInScopeParserIds()
    if (!parserOrder.length) return this
    const orderMap: particlesTypes.stringMap = {}
    parserOrder.forEach((word, index) => (orderMap[word] = index))
    this.sort(Utils.makeSortByFn((runtimeParticle: ParserBackedParticle) => orderMap[runtimeParticle.definition.parserIdFromDefinition]))
    return this
  }

  protected get requiredParticleErrors() {
    const errors: particlesTypes.ParticleError[] = []
    Object.values(this.definition.firstWordMapWithDefinitions).forEach(def => {
      if (def.isRequired() && !this.particleIndex[def.id]) errors.push(new MissingRequiredParserError(this, def.id))
    })
    return errors
  }

  get programAsCells() {
    // todo: what is this?
    return this.topDownArray.map((particle: ParserBackedParticle) => {
      const cells = particle.parsedCells
      let indents = particle.getIndentLevel() - 1
      while (indents) {
        cells.unshift(undefined)
        indents--
      }
      return cells
    })
  }

  get programWidth() {
    return Math.max(...this.programAsCells.map(line => line.length))
  }

  get allTypedWords() {
    const words: TypedWord[] = []
    this.topDownArray.forEach((particle: ParserBackedParticle) => particle.wordTypes.forEach((cell, index) => words.push(new TypedWord(particle, index, cell.cellTypeId))))
    return words
  }

  findAllWordsWithCellType(cellTypeId: particlesTypes.cellTypeId) {
    return this.allTypedWords.filter(typedWord => typedWord.type === cellTypeId)
  }

  findAllParticlesWithParser(parserId: particlesTypes.parserId) {
    return this.topDownArray.filter((particle: ParserBackedParticle) => particle.definition.parserIdFromDefinition === parserId)
  }

  toCellTypeParticles() {
    return this.topDownArray.map(child => child.indentation + child.lineCellTypes).join("\n")
  }

  getParseTable(maxColumnWidth = 40) {
    const particle = new Particle(this.toCellTypeParticles())
    return new Particle(
      particle.topDownArray.map((particle, lineNumber) => {
        const sourceParticle = this.particleAtLine(lineNumber)
        const errs = sourceParticle.getErrors()
        const errorCount = errs.length
        const obj: any = {
          lineNumber: lineNumber,
          source: sourceParticle.indentation + sourceParticle.getLine(),
          parser: sourceParticle.constructor.name,
          cellTypes: particle.content,
          errorCount: errorCount
        }
        if (errorCount) obj.errorMessages = errs.map(err => err.message).join(";")
        return obj
      })
    ).toFormattedTable(maxColumnWidth)
  }

  // Helper method for selecting potential parsers needed to update parsers file.
  get invalidParsers() {
    return Array.from(
      new Set(
        this.getAllErrors()
          .filter(err => err instanceof UnknownParserError)
          .map(err => err.getParticle().firstWord)
      )
    )
  }

  private _getAllAutoCompleteWords() {
    return this.getAllWordBoundaryCoordinates().map(coordinate => {
      const results = this.getAutocompleteResultsAt(coordinate.lineIndex, coordinate.charIndex)
      return {
        lineIndex: coordinate.lineIndex,
        charIndex: coordinate.charIndex,
        wordIndex: coordinate.wordIndex,
        word: results.word,
        suggestions: results.matches
      }
    })
  }

  toAutoCompleteCube(fillChar = "") {
    const particles: any[] = [this.clone()]
    const filled = this.clone().fill(fillChar)
    this._getAllAutoCompleteWords().forEach(hole => {
      hole.suggestions.forEach((suggestion, index) => {
        if (!particles[index + 1]) particles[index + 1] = filled.clone()
        particles[index + 1].particleAtLine(hole.lineIndex).setWord(hole.wordIndex, suggestion.text)
      })
    })
    return new Particle(particles)
  }

  toAutoCompleteTable() {
    return new Particle(
      <any>this._getAllAutoCompleteWords().map(result => {
        result.suggestions = <any>result.suggestions.map((particle: any) => particle.text).join(" ")
        return result
      })
    ).asTable
  }

  getAutocompleteResultsAt(lineIndex: particlesTypes.positiveInt, charIndex: particlesTypes.positiveInt) {
    const lineParticle = this.particleAtLine(lineIndex) || this
    const particleInScope = <ParserBackedParticle>lineParticle.getParticleInScopeAtCharIndex(charIndex)

    // todo: add more tests
    // todo: second param this.childrenToString()
    // todo: change to getAutocomplete definitions

    const wordIndex = lineParticle.getWordIndexAtCharacterIndex(charIndex)
    const wordProperties = lineParticle.getWordProperties(wordIndex)
    return {
      startCharIndex: wordProperties.startCharIndex,
      endCharIndex: wordProperties.endCharIndex,
      word: wordProperties.word,
      matches: particleInScope.getAutocompleteResults(wordProperties.word, wordIndex)
    }
  }

  private _sortWithParentParsersUpTop() {
    const lineage = new HandParsersProgram(this.toString()).parserLineage
    const rank: particlesTypes.stringMap = {}
    lineage.topDownArray.forEach((particle, index) => {
      rank[particle.getWord(0)] = index
    })
    const particleAFirst = -1
    const particleBFirst = 1
    this.sort((particleA, particleB) => {
      const particleARank = rank[particleA.getWord(0)]
      const particleBRank = rank[particleB.getWord(0)]
      return particleARank < particleBRank ? particleAFirst : particleBFirst
    })
    return this
  }

  format() {
    if (this.isRoot()) {
      this._sortParticlesByInScopeOrder()

      try {
        this._sortWithParentParsersUpTop()
      } catch (err) {
        console.log(`Warning: ${err}`)
      }
    }
    this.topDownArray.forEach(child => child.format())
    return this
  }

  getParserUsage(filepath = "") {
    // returns a report on what parsers from its language the program uses
    const usage = new Particle()
    const handParsersProgram = this.handParsersProgram
    handParsersProgram.validConcreteAndAbstractParserDefinitions.forEach((def: AbstractParserDefinitionParser) => {
      const requiredCellTypeIds = def.cellParser.getRequiredCellTypeIds()
      usage.appendLine([def.parserIdFromDefinition, "line-id", "parser", requiredCellTypeIds.join(" ")].join(" "))
    })
    this.topDownArray.forEach((particle: ParserBackedParticle, lineNumber: number) => {
      const stats = usage.getParticle(particle.parserId)
      stats.appendLine([filepath + "-" + lineNumber, particle.words.join(" ")].join(" "))
    })
    return usage
  }

  toPaintParticles() {
    return this.topDownArray.map((child: ParserBackedParticle) => child.indentation + child.getLinePaints()).join("\n")
  }

  toDefinitionLineNumberParticles() {
    return this.topDownArray.map((child: ParserBackedParticle) => child.definition.lineNumber + " " + child.indentation + child.cellDefinitionLineNumbers.join(" ")).join("\n")
  }

  get asCellTypeParticlesWithParserIds() {
    return this.topDownArray.map((child: ParserBackedParticle) => child.constructor.name + this.wordBreakSymbol + child.indentation + child.lineCellTypes).join("\n")
  }

  toPreludeCellTypeParticlesWithParserIds() {
    return this.topDownArray.map((child: ParserBackedParticle) => child.constructor.name + this.wordBreakSymbol + child.indentation + child.getLineCellPreludeTypes()).join("\n")
  }

  get asParticlesWithParsers() {
    return this.topDownArray.map((child: ParserBackedParticle) => child.constructor.name + this.wordBreakSymbol + child.indentation + child.getLine()).join("\n")
  }

  getCellPaintAtPosition(lineIndex: number, wordIndex: number): particlesTypes.paint | undefined {
    this._initCellTypeCache()
    const typeParticle = this._cache_paintParticles.topDownArray[lineIndex - 1]
    return typeParticle ? typeParticle.getWord(wordIndex - 1) : undefined
  }

  private _cache_programCellTypeStringMTime: number
  private _cache_paintParticles: Particle
  private _cache_typeParticles: Particle

  protected _initCellTypeCache(): void {
    const particleMTime = this.getLineOrChildrenModifiedTime()
    if (this._cache_programCellTypeStringMTime === particleMTime) return undefined

    this._cache_typeParticles = new Particle(this.toCellTypeParticles())
    this._cache_paintParticles = new Particle(this.toPaintParticles())
    this._cache_programCellTypeStringMTime = particleMTime
  }

  createParserCombinator() {
    return this.isRoot() ? new Particle.ParserCombinator(BlobParser) : new Particle.ParserCombinator(this.parent._getParser()._getCatchAllParser(this.parent), {})
  }

  get parserId(): particlesTypes.parserId {
    return this.definition.parserIdFromDefinition
  }

  get wordTypes() {
    return this.parsedCells.filter(cell => cell.getWord() !== undefined)
  }

  private get cellErrors() {
    const { parsedCells } = this // todo: speedup. takes ~3s on pldb.

    // todo: speedup getErrorIfAny. takes ~3s on pldb.
    return parsedCells.map(check => check.getErrorIfAny()).filter(identity => identity)
  }

  private get singleParserUsedTwiceErrors() {
    const errors: particlesTypes.ParticleError[] = []
    const parent = this.parent as ParserBackedParticle
    const hits = parent.getChildInstancesOfParserId(this.definition.id)

    if (hits.length > 1)
      hits.forEach((particle, index) => {
        if (particle === this) errors.push(new ParserUsedMultipleTimesError(<ParserBackedParticle>particle))
      })
    return errors
  }

  private get uniqueLineAppearsTwiceErrors() {
    const errors: particlesTypes.ParticleError[] = []
    const parent = this.parent as ParserBackedParticle
    const hits = parent.getChildInstancesOfParserId(this.definition.id)

    if (hits.length > 1) {
      const set = new Set()
      hits.forEach((particle, index) => {
        const line = particle.getLine()
        if (set.has(line)) errors.push(new ParserUsedMultipleTimesError(<ParserBackedParticle>particle))
        set.add(line)
      })
    }
    return errors
  }

  get scopeErrors() {
    let errors: particlesTypes.ParticleError[] = []
    const def = this.definition
    if (def.isSingle) errors = errors.concat(this.singleParserUsedTwiceErrors) // todo: speedup. takes ~1s on pldb.
    if (def.isUniqueLine) errors = errors.concat(this.uniqueLineAppearsTwiceErrors) // todo: speedup. takes ~1s on pldb.

    const { requiredParticleErrors } = this // todo: speedup. takes ~1.5s on pldb.
    if (requiredParticleErrors.length) errors = errors.concat(requiredParticleErrors)
    return errors
  }

  getErrors() {
    return this.cellErrors.concat(this.scopeErrors)
  }

  get parsedCells(): AbstractParsersBackedCell<any>[] {
    return this.definition.cellParser.getCellArray(this)
  }

  // todo: just make a fn that computes proper spacing and then is given a particle to print
  get lineCellTypes() {
    return this.parsedCells.map(slot => slot.cellTypeId).join(" ")
  }

  getLineCellPreludeTypes() {
    return this.parsedCells
      .map(slot => {
        const def = slot.cellTypeDefinition
        //todo: cleanup
        return def ? def.preludeKindId : PreludeCellTypeIds.anyCell
      })
      .join(" ")
  }

  getLinePaints(defaultScope = "source") {
    return this.parsedCells.map(slot => slot.paint || defaultScope).join(" ")
  }

  get cellDefinitionLineNumbers() {
    return this.parsedCells.map(cell => cell.definitionLineNumber)
  }

  protected _getCompiledIndentation() {
    const indentCharacter = this.definition._getCompilerObject()[ParsersConstantsCompiler.indentCharacter]
    const indent = this.indentation
    return indentCharacter !== undefined ? indentCharacter.repeat(indent.length) : indent
  }

  private _getFields() {
    // fields are like cells
    const fields: any = {}
    this.forEach(particle => {
      const def = particle.definition
      if (def.isRequired() || def.isSingle) fields[particle.getWord(0)] = particle.content
    })
    return fields
  }

  protected _getCompiledLine() {
    const compiler = this.definition._getCompilerObject()
    const catchAllCellDelimiter = compiler[ParsersConstantsCompiler.catchAllCellDelimiter]
    const str = compiler[ParsersConstantsCompiler.stringTemplate]
    return str !== undefined ? Utils.formatStr(str, catchAllCellDelimiter, Object.assign(this._getFields(), this.cells)) : this.getLine()
  }

  protected get listDelimiter() {
    return this.definition._getFromExtended(ParsersConstants.listDelimiter)
  }

  protected get contentKey() {
    return this.definition._getFromExtended(ParsersConstants.contentKey)
  }

  protected get childrenKey() {
    return this.definition._getFromExtended(ParsersConstants.childrenKey)
  }

  protected get childrenAreTextBlob() {
    return this.definition._isBlobParser()
  }

  protected get isArrayElement() {
    return this.definition._hasFromExtended(ParsersConstants.uniqueFirstWord) ? false : !this.definition.isSingle
  }

  get list() {
    return this.listDelimiter ? this.content.split(this.listDelimiter) : super.list
  }

  get typedContent() {
    // todo: probably a better way to do this, perhaps by defining a cellDelimiter at the particle level
    // todo: this currently parse anything other than string types
    if (this.listDelimiter) return this.content.split(this.listDelimiter)

    const cells = this.parsedCells
    if (cells.length === 2) return cells[1].parsed
    return this.content
  }

  get typedTuple() {
    const key = this.firstWord
    if (this.childrenAreTextBlob) return [key, this.childrenToString()]

    const { typedContent, contentKey, childrenKey } = this

    if (contentKey || childrenKey) {
      let obj: any = {}
      if (childrenKey) obj[childrenKey] = this.childrenToString()
      else obj = this.typedMap

      if (contentKey) {
        obj[contentKey] = typedContent
      }
      return [key, obj]
    }

    const hasChildren = this.length > 0

    const hasChildrenNoContent = typedContent === undefined && hasChildren
    const shouldReturnValueAsObject = hasChildrenNoContent
    if (shouldReturnValueAsObject) return [key, this.typedMap]

    const hasChildrenAndContent = typedContent !== undefined && hasChildren
    const shouldReturnValueAsContentPlusChildren = hasChildrenAndContent

    // If the particle has a content and a subparticle return it as a string, as
    // Javascript object values can't be both a leaf and a particle.
    if (shouldReturnValueAsContentPlusChildren) return [key, this.contentWithChildren]

    return [key, typedContent]
  }

  get _shouldSerialize() {
    const should = (<any>this).shouldSerialize
    return should === undefined ? true : should
  }

  get typedMap() {
    const obj: particlesTypes.stringMap = {}
    this.forEach((particle: ParserBackedParticle) => {
      if (!particle._shouldSerialize) return true

      const tuple = particle.typedTuple
      if (!particle.isArrayElement) obj[tuple[0]] = tuple[1]
      else {
        if (!obj[tuple[0]]) obj[tuple[0]] = []
        obj[tuple[0]].push(tuple[1])
      }
    })
    return obj
  }

  fromTypedMap() {}

  compile() {
    if (this.isRoot()) return super.compile()
    const def = this.definition
    const indent = this._getCompiledIndentation()
    const compiledLine = this._getCompiledLine()

    if (def.isTerminalParser()) return indent + compiledLine

    const compiler = def._getCompilerObject()
    const openChildrenString = compiler[ParsersConstantsCompiler.openChildren] || ""
    const closeChildrenString = compiler[ParsersConstantsCompiler.closeChildren] || ""
    const childJoinCharacter = compiler[ParsersConstantsCompiler.joinChildrenWith] || "\n"

    const compiledChildren = this.map(child => child.compile()).join(childJoinCharacter)

    return `${indent + compiledLine}${openChildrenString}
${compiledChildren}
${indent}${closeChildrenString}`
  }

  // todo: remove
  get cells() {
    const cells: particlesTypes.stringMap = {}
    this.parsedCells.forEach(cell => {
      const cellTypeId = cell.cellTypeId
      if (!cell.isCatchAll()) cells[cellTypeId] = cell.parsed
      else {
        if (!cells[cellTypeId]) cells[cellTypeId] = []
        cells[cellTypeId].push(cell.parsed)
      }
    })
    return cells
  }
}

class BlobParser extends ParserBackedParticle {
  createParserCombinator() {
    return new Particle.ParserCombinator(BlobParser, {})
  }

  getErrors(): particlesTypes.ParticleError[] {
    return []
  }
}

// todo: can we remove this? hard to extend.
class UnknownParserParticle extends ParserBackedParticle {
  createParserCombinator() {
    return new Particle.ParserCombinator(UnknownParserParticle, {})
  }

  getErrors(): particlesTypes.ParticleError[] {
    return [new UnknownParserError(this)]
  }
}

/*
A cell contains a word but also the type information for that word.
*/
abstract class AbstractParsersBackedCell<T> {
  constructor(particle: ParserBackedParticle, index: particlesTypes.int, typeDef: cellTypeDefinitionParser, cellTypeId: string, isCatchAll: boolean, parserDefinitionParser: AbstractParserDefinitionParser) {
    this._typeDef = typeDef
    this._particle = particle
    this._isCatchAll = isCatchAll
    this._index = index
    this._cellTypeId = cellTypeId
    this._parserDefinitionParser = parserDefinitionParser
  }

  getWord() {
    return this._particle.getWord(this._index)
  }

  get definitionLineNumber() {
    return this._typeDef.lineNumber
  }

  private _particle: ParserBackedParticle
  protected _index: particlesTypes.int
  private _typeDef: cellTypeDefinitionParser
  private _isCatchAll: boolean
  private _cellTypeId: string
  protected _parserDefinitionParser: AbstractParserDefinitionParser

  get cellTypeId() {
    return this._cellTypeId
  }

  static parserFunctionName = ""

  getParticle() {
    return this._particle
  }

  get cellIndex() {
    return this._index
  }

  isCatchAll() {
    return this._isCatchAll
  }

  get min() {
    return this.cellTypeDefinition.get(ParsersConstants.min) || "0"
  }

  get max() {
    return this.cellTypeDefinition.get(ParsersConstants.max) || "100"
  }

  get placeholder() {
    return this.cellTypeDefinition.get(ParsersConstants.examples) || ""
  }

  abstract get parsed(): T

  get paint(): string | undefined {
    const definition = this.cellTypeDefinition
    if (definition) return definition.paint // todo: why the undefined?
  }

  getAutoCompleteWords(partialWord: string = "") {
    const cellDef = this.cellTypeDefinition
    let words = cellDef ? cellDef._getAutocompleteWordOptions(<ParserBackedParticle>this.getParticle().root) : []

    const runTimeOptions = this.getParticle().getRunTimeEnumOptions(this)
    if (runTimeOptions) words = runTimeOptions.concat(words)

    if (partialWord) words = words.filter(word => word.includes(partialWord))
    return words.map(word => {
      return {
        text: word,
        displayText: word
      }
    })
  }

  synthesizeCell(seed = Date.now()): string {
    // todo: cleanup
    const cellDef = this.cellTypeDefinition
    const enumOptions = cellDef._getFromExtended(ParsersConstants.enum)
    if (enumOptions) return Utils.getRandomString(1, enumOptions.split(" "))

    return this._synthesizeCell(seed)
  }

  _getStumpEnumInput(crux: string): string {
    const cellDef = this.cellTypeDefinition
    const enumOptions = cellDef._getFromExtended(ParsersConstants.enum)
    if (!enumOptions) return undefined
    const options = new Particle(
      enumOptions
        .split(" ")
        .map(option => `option ${option}`)
        .join("\n")
    )
    return `select
 name ${crux}
${options.toString(1)}`
  }

  _toStumpInput(crux: string): string {
    // todo: remove
    const enumInput = this._getStumpEnumInput(crux)
    if (enumInput) return enumInput
    // todo: cleanup. We shouldn't have these dual cellType classes.
    return `input
 name ${crux}
 placeholder ${this.placeholder}`
  }

  abstract _synthesizeCell(seed?: number): string

  get cellTypeDefinition() {
    return this._typeDef
  }

  protected _getErrorContext() {
    return this.getParticle().getLine().split(" ")[0] // todo: WordBreakSymbol
  }

  protected abstract _isValid(): boolean

  isValid(): boolean {
    const runTimeOptions = this.getParticle().getRunTimeEnumOptionsForValidation(this)
    const word = this.getWord()
    if (runTimeOptions) return runTimeOptions.includes(word)
    return this.cellTypeDefinition.isValid(word, <ParserBackedParticle>this.getParticle().root) && this._isValid()
  }

  getErrorIfAny(): particlesTypes.ParticleError {
    const word = this.getWord()
    if (word !== undefined && this.isValid()) return undefined

    // todo: refactor invalidwordError. We want better error messages.
    return word === undefined || word === "" ? new MissingWordError(this) : new InvalidWordError(this)
  }
}

class ParsersBitCell extends AbstractParsersBackedCell<boolean> {
  _isValid() {
    const word = this.getWord()
    return word === "0" || word === "1"
  }

  static defaultPaint = "constant.numeric"

  _synthesizeCell() {
    return Utils.getRandomString(1, "01".split(""))
  }

  get regexString() {
    return "[01]"
  }

  get parsed() {
    const word = this.getWord()
    return !!parseInt(word)
  }
}

abstract class ParsersNumericCell extends AbstractParsersBackedCell<number> {
  _toStumpInput(crux: string): string {
    return `input
 name ${crux}
 type number
 placeholder ${this.placeholder}
 min ${this.min}
 max ${this.max}`
  }
}

class ParsersIntCell extends ParsersNumericCell {
  _isValid() {
    const word = this.getWord()
    const num = parseInt(word)
    if (isNaN(num)) return false
    return num.toString() === word
  }

  static defaultPaint = "constant.numeric.integer"

  _synthesizeCell(seed: number) {
    return Utils.randomUniformInt(parseInt(this.min), parseInt(this.max), seed).toString()
  }

  get regexString() {
    return "-?[0-9]+"
  }

  get parsed() {
    const word = this.getWord()
    return parseInt(word)
  }

  static parserFunctionName = "parseInt"
}

class ParsersFloatCell extends ParsersNumericCell {
  _isValid() {
    const word = this.getWord()
    const num = parseFloat(word)
    return !isNaN(num) && /^-?\d*(\.\d+)?([eE][+-]?\d+)?$/.test(word)
  }

  static defaultPaint = "constant.numeric.float"

  _synthesizeCell(seed: number) {
    return Utils.randomUniformFloat(parseFloat(this.min), parseFloat(this.max), seed).toString()
  }

  get regexString() {
    return "-?d*(.d+)?"
  }

  get parsed() {
    const word = this.getWord()
    return parseFloat(word)
  }

  static parserFunctionName = "parseFloat"
}

// ErrorCellType => parsers asks for a '' cell type here but the parsers does not specify a '' cell type. (todo: bring in didyoumean?)

class ParsersBoolCell extends AbstractParsersBackedCell<boolean> {
  private _trues = new Set(["1", "true", "t", "yes"])
  private _falses = new Set(["0", "false", "f", "no"])

  _isValid() {
    const word = this.getWord()
    const str = word.toLowerCase()
    return this._trues.has(str) || this._falses.has(str)
  }

  static defaultPaint = "constant.numeric"

  _synthesizeCell() {
    return Utils.getRandomString(1, ["1", "true", "t", "yes", "0", "false", "f", "no"])
  }

  private _getOptions() {
    return Array.from(this._trues).concat(Array.from(this._falses))
  }

  get regexString() {
    return "(?:" + this._getOptions().join("|") + ")"
  }

  get parsed() {
    const word = this.getWord()
    return this._trues.has(word.toLowerCase())
  }
}

class ParsersAnyCell extends AbstractParsersBackedCell<string> {
  _isValid() {
    return true
  }

  _synthesizeCell() {
    const examples = this.cellTypeDefinition._getFromExtended(ParsersConstants.examples)
    if (examples) return Utils.getRandomString(1, examples.split(" "))
    return this._parserDefinitionParser.parserIdFromDefinition + "-" + this.constructor.name
  }

  get regexString() {
    return "[^ ]+"
  }

  get parsed() {
    return this.getWord()
  }
}

class ParsersKeywordCell extends ParsersAnyCell {
  static defaultPaint = "keyword"

  _synthesizeCell() {
    return this._parserDefinitionParser.cruxIfAny
  }
}

class ParsersExtraWordCellTypeCell extends AbstractParsersBackedCell<string> {
  _isValid() {
    return false
  }

  synthesizeCell() {
    throw new Error(`Trying to synthesize a ParsersExtraWordCellTypeCell`)
    return this._synthesizeCell()
  }

  _synthesizeCell() {
    return "extraWord" // should never occur?
  }

  get parsed() {
    return this.getWord()
  }

  getErrorIfAny(): particlesTypes.ParticleError {
    return new ExtraWordError(this)
  }
}

class ParsersUnknownCellTypeCell extends AbstractParsersBackedCell<string> {
  _isValid() {
    return false
  }

  synthesizeCell() {
    throw new Error(`Trying to synthesize an ParsersUnknownCellTypeCell`)
    return this._synthesizeCell()
  }

  _synthesizeCell() {
    return "extraWord" // should never occur?
  }

  get parsed() {
    return this.getWord()
  }

  getErrorIfAny(): particlesTypes.ParticleError {
    return new UnknownCellTypeError(this)
  }
}

abstract class AbstractParticleError implements particlesTypes.ParticleError {
  constructor(particle: ParserBackedParticle) {
    this._particle = particle
  }
  private _particle: ParserBackedParticle // todo: would it ever be a Particle?

  getLineIndex(): particlesTypes.positiveInt {
    return this.lineNumber - 1
  }

  get lineNumber(): particlesTypes.positiveInt {
    return this.getParticle()._getLineNumber() // todo: handle sourcemaps
  }

  isCursorOnWord(lineIndex: particlesTypes.positiveInt, characterIndex: particlesTypes.positiveInt) {
    return lineIndex === this.getLineIndex() && this._doesCharacterIndexFallOnWord(characterIndex)
  }

  private _doesCharacterIndexFallOnWord(characterIndex: particlesTypes.positiveInt) {
    return this.cellIndex === this.getParticle().getWordIndexAtCharacterIndex(characterIndex)
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
    return this.getParticle().indentation
  }

  getCodeMirrorLineWidgetElement(onApplySuggestionCallBack = () => {}) {
    const suggestion = this.suggestionMessage
    if (this.isMissingWordError()) return this._getCodeMirrorLineWidgetElementCellTypeHints()
    if (suggestion) return this._getCodeMirrorLineWidgetElementWithSuggestion(onApplySuggestionCallBack, suggestion)
    return this._getCodeMirrorLineWidgetElementWithoutSuggestion()
  }

  get parserId(): string {
    return (<ParserBackedParticle>this.getParticle()).definition.parserIdFromDefinition
  }

  private _getCodeMirrorLineWidgetElementCellTypeHints() {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + (<ParserBackedParticle>this.getParticle()).definition.lineHints))
    el.className = "LintCellTypeHints"
    return el
  }

  private _getCodeMirrorLineWidgetElementWithoutSuggestion() {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + this.message))
    el.className = "LintError"
    return el
  }

  private _getCodeMirrorLineWidgetElementWithSuggestion(onApplySuggestionCallBack: Function, suggestion: string) {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + `${this.errorTypeName}. Suggestion: ${suggestion}`))
    el.className = "LintErrorWithSuggestion"
    el.onclick = () => {
      this.applySuggestion()
      onApplySuggestionCallBack()
    }
    return el
  }

  getLine() {
    return this.getParticle().getLine()
  }

  getExtension() {
    return this.getParticle().handParsersProgram.extensionName
  }

  getParticle() {
    return this._particle
  }

  get errorTypeName() {
    return this.constructor.name.replace("Error", "")
  }

  get cellIndex() {
    return 0
  }

  toObject() {
    return {
      type: this.errorTypeName,
      line: this.lineNumber,
      cell: this.cellIndex,
      suggestion: this.suggestionMessage,
      path: this.getParticle().getFirstWordPath(),
      message: this.message
    }
  }

  hasSuggestion() {
    return this.suggestionMessage !== ""
  }

  get suggestionMessage() {
    return ""
  }

  toString() {
    return this.message
  }

  applySuggestion() {}

  get message(): string {
    return `${this.errorTypeName} at line ${this.lineNumber} cell ${this.cellIndex}.`
  }
}

abstract class AbstractCellError extends AbstractParticleError {
  constructor(cell: AbstractParsersBackedCell<any>) {
    super(cell.getParticle())
    this._cell = cell
  }

  get cell() {
    return this._cell
  }

  get cellIndex() {
    return this._cell.cellIndex
  }

  protected get wordSuggestion() {
    return Utils.didYouMean(
      this.cell.getWord(),
      this.cell.getAutoCompleteWords().map(option => option.text)
    )
  }

  private _cell: AbstractParsersBackedCell<any>
}

class UnknownParserError extends AbstractParticleError {
  get message(): string {
    const particle = this.getParticle()
    const parentParticle = particle.parent
    const options = parentParticle._getParser().getFirstWordOptions()
    return super.message + ` Invalid parser "${particle.firstWord}". Valid parsers are: ${Utils._listToEnglishText(options, 7)}.`
  }

  protected get wordSuggestion() {
    const particle = this.getParticle()
    const parentParticle = particle.parent
    return Utils.didYouMean(
      particle.firstWord,
      (<ParserBackedParticle>parentParticle).getAutocompleteResults("", 0).map(option => option.text)
    )
  }

  get suggestionMessage() {
    const suggestion = this.wordSuggestion
    const particle = this.getParticle()

    if (suggestion) return `Change "${particle.firstWord}" to "${suggestion}"`

    return ""
  }

  applySuggestion() {
    const suggestion = this.wordSuggestion
    if (suggestion) this.getParticle().setWord(this.cellIndex, suggestion)
    return this
  }
}

class ParserDefinedError extends AbstractParticleError {
  constructor(particle: ParserBackedParticle, message: string) {
    super()
    this._particle = particle
    this._message = message
  }
  private _message: string
  get message() {
    return this._message
  }
}

class BlankLineError extends UnknownParserError {
  get message(): string {
    return super.message + ` Line: "${this.getParticle().getLine()}". Blank lines are errors.`
  }

  // convenience method
  isBlankLineError() {
    return true
  }

  get suggestionMessage() {
    return `Delete line ${this.lineNumber}`
  }

  applySuggestion() {
    this.getParticle().destroy()
    return this
  }
}

class MissingRequiredParserError extends AbstractParticleError {
  constructor(particle: ParserBackedParticle, missingParserId: particlesTypes.firstWord) {
    super(particle)
    this._missingParserId = missingParserId
  }

  private _missingParserId: particlesTypes.parserId

  get message(): string {
    return super.message + ` A "${this._missingParserId}" is required.`
  }
}

class ParserUsedMultipleTimesError extends AbstractParticleError {
  get message(): string {
    return super.message + ` Multiple "${this.getParticle().firstWord}" found.`
  }

  get suggestionMessage() {
    return `Delete line ${this.lineNumber}`
  }

  applySuggestion() {
    return this.getParticle().destroy()
  }
}

class LineAppearsMultipleTimesError extends AbstractParticleError {
  get message(): string {
    return super.message + ` "${this.getParticle().getLine()}" appears multiple times.`
  }

  get suggestionMessage() {
    return `Delete line ${this.lineNumber}`
  }

  applySuggestion() {
    return this.getParticle().destroy()
  }
}

class UnknownCellTypeError extends AbstractCellError {
  get message(): string {
    return super.message + ` No cellType "${this.cell.cellTypeId}" found. Language parsers for "${this.getExtension()}" may need to be fixed.`
  }
}

class InvalidWordError extends AbstractCellError {
  get message(): string {
    return super.message + ` "${this.cell.getWord()}" does not fit in cellType "${this.cell.cellTypeId}".`
  }

  get suggestionMessage() {
    const suggestion = this.wordSuggestion

    if (suggestion) return `Change "${this.cell.getWord()}" to "${suggestion}"`

    return ""
  }

  applySuggestion() {
    const suggestion = this.wordSuggestion
    if (suggestion) this.getParticle().setWord(this.cellIndex, suggestion)
    return this
  }
}

class ExtraWordError extends AbstractCellError {
  get message(): string {
    return super.message + ` Extra word "${this.cell.getWord()}" in ${this.parserId}.`
  }

  get suggestionMessage() {
    return `Delete word "${this.cell.getWord()}" at cell ${this.cellIndex}`
  }

  applySuggestion() {
    return this.getParticle().deleteWordAt(this.cellIndex)
  }
}

class MissingWordError extends AbstractCellError {
  // todo: autocomplete suggestion

  get message(): string {
    return super.message + ` Missing word for cell "${this.cell.cellTypeId}".`
  }

  isMissingWordError() {
    return true
  }
}

// todo: add standard types, enum types, from disk types

abstract class AbstractParsersWordTestParser extends Particle {
  abstract isValid(str: string, programRootParticle?: ParserBackedParticle): boolean
}

class ParsersRegexTestParser extends AbstractParsersWordTestParser {
  private _regex: RegExp

  isValid(str: string) {
    if (!this._regex) this._regex = new RegExp("^" + this.content + "$")
    return !!str.match(this._regex)
  }
}

class ParsersReservedWordsTestParser extends AbstractParsersWordTestParser {
  private _set: Set<string>

  isValid(str: string) {
    if (!this._set) this._set = new Set(this.content.split(" "))
    return !this._set.has(str)
  }
}

// todo: remove in favor of custom word type constructors
class EnumFromCellTypesTestParser extends AbstractParsersWordTestParser {
  _getEnumFromCellTypes(programRootParticle: ParserBackedParticle): particlesTypes.stringMap {
    const cellTypeIds = this.getWordsFrom(1)
    const enumGroup = cellTypeIds.join(" ")
    // note: hack where we store it on the program. otherwise has global effects.
    if (!(<any>programRootParticle)._enumMaps) (<any>programRootParticle)._enumMaps = {}
    if ((<any>programRootParticle)._enumMaps[enumGroup]) return (<any>programRootParticle)._enumMaps[enumGroup]

    const wordIndex = 1
    const map: particlesTypes.stringMap = {}
    const cellTypeMap: particlesTypes.stringMap = {}
    cellTypeIds.forEach(typeId => (cellTypeMap[typeId] = true))
    programRootParticle.allTypedWords
      .filter((typedWord: TypedWord) => cellTypeMap[typedWord.type])
      .forEach(typedWord => {
        map[typedWord.word] = true
      })
    ;(<any>programRootParticle)._enumMaps[enumGroup] = map
    return map
  }

  // todo: remove
  isValid(str: string, programRootParticle: ParserBackedParticle) {
    return this._getEnumFromCellTypes(programRootParticle)[str] === true
  }
}

class ParsersEnumTestParticle extends AbstractParsersWordTestParser {
  private _map: particlesTypes.stringMap

  isValid(str: string) {
    // enum c c++ java
    return !!this.getOptions()[str]
  }

  getOptions() {
    if (!this._map) this._map = Utils.arrayToMap(this.getWordsFrom(1))
    return this._map
  }
}

class cellTypeDefinitionParser extends AbstractExtendibleParticle {
  createParserCombinator() {
    const types: particlesTypes.stringMap = {}
    types[ParsersConstants.regex] = ParsersRegexTestParser
    types[ParsersConstants.reservedWords] = ParsersReservedWordsTestParser
    types[ParsersConstants.enumFromCellTypes] = EnumFromCellTypesTestParser
    types[ParsersConstants.enum] = ParsersEnumTestParticle
    types[ParsersConstants.paint] = Particle
    types[ParsersConstants.comment] = Particle
    types[ParsersConstants.examples] = Particle
    types[ParsersConstants.min] = Particle
    types[ParsersConstants.max] = Particle
    types[ParsersConstants.description] = Particle
    types[ParsersConstants.extends] = Particle
    return new Particle.ParserCombinator(undefined, types)
  }

  get id() {
    return this.getWord(0)
  }

  get idToParticleMap() {
    return (<HandParsersProgram>this.parent).cellTypeDefinitions
  }

  getGetter(wordIndex: number) {
    const wordToNativeJavascriptTypeParser = this.getCellConstructor().parserFunctionName
    return `get ${this.cellTypeId}() {
      return ${wordToNativeJavascriptTypeParser ? wordToNativeJavascriptTypeParser + `(this.getWord(${wordIndex}))` : `this.getWord(${wordIndex})`}
    }`
  }

  getCatchAllGetter(wordIndex: number) {
    const wordToNativeJavascriptTypeParser = this.getCellConstructor().parserFunctionName
    return `get ${this.cellTypeId}() {
      return ${wordToNativeJavascriptTypeParser ? `this.getWordsFrom(${wordIndex}).map(val => ${wordToNativeJavascriptTypeParser}(val))` : `this.getWordsFrom(${wordIndex})`}
    }`
  }

  // `this.getWordsFrom(${requireds.length + 1})`

  // todo: cleanup typings. todo: remove this hidden logic. have a "baseType" property?
  getCellConstructor(): typeof AbstractParsersBackedCell {
    return this.preludeKind || ParsersAnyCell
  }

  get preludeKind() {
    return PreludeKinds[this.getWord(0)] || PreludeKinds[this._getExtendedCellTypeId()]
  }

  get preludeKindId() {
    if (PreludeKinds[this.getWord(0)]) return this.getWord(0)
    else if (PreludeKinds[this._getExtendedCellTypeId()]) return this._getExtendedCellTypeId()
    return PreludeCellTypeIds.anyCell
  }

  private _getExtendedCellTypeId() {
    const arr = this._getAncestorsArray()
    return arr[arr.length - 1].id
  }

  get paint(): string | undefined {
    const hs = this._getFromExtended(ParsersConstants.paint)
    if (hs) return hs
    const preludeKind = this.preludeKind
    if (preludeKind) return preludeKind.defaultPaint
  }

  _getEnumOptions() {
    const enumParticle = this._getParticleFromExtended(ParsersConstants.enum)
    if (!enumParticle) return undefined

    // we sort by longest first to capture longest match first. todo: add test
    const options = Object.keys((<ParsersEnumTestParticle>enumParticle.getParticle(ParsersConstants.enum)).getOptions())
    options.sort((a, b) => b.length - a.length)

    return options
  }

  private _getEnumFromCellTypeOptions(program: ParserBackedParticle) {
    const particle = this._getParticleFromExtended(ParsersConstants.enumFromCellTypes)
    return particle ? Object.keys((<EnumFromCellTypesTestParser>particle.getParticle(ParsersConstants.enumFromCellTypes))._getEnumFromCellTypes(program)) : undefined
  }

  _getAutocompleteWordOptions(program: ParserBackedParticle): string[] {
    return this._getEnumOptions() || this._getEnumFromCellTypeOptions(program) || []
  }

  get regexString() {
    // todo: enum
    const enumOptions = this._getEnumOptions()
    return this._getFromExtended(ParsersConstants.regex) || (enumOptions ? "(?:" + enumOptions.join("|") + ")" : "[^ ]*")
  }

  private _getAllTests() {
    return this._getChildrenByParserInExtended(AbstractParsersWordTestParser)
  }

  isValid(str: string, programRootParticle: ParserBackedParticle) {
    return this._getAllTests().every(particle => (<AbstractParsersWordTestParser>particle).isValid(str, programRootParticle))
  }

  get cellTypeId(): particlesTypes.cellTypeId {
    return this.getWord(0)
  }

  public static types: any
}

abstract class AbstractCellParser {
  constructor(definition: AbstractParserDefinitionParser) {
    this._definition = definition
  }

  get catchAllCellTypeId(): particlesTypes.cellTypeId | undefined {
    return this._definition._getFromExtended(ParsersConstants.catchAllCellType)
  }

  // todo: improve layout (use bold?)
  get lineHints(): string {
    const catchAllCellTypeId = this.catchAllCellTypeId
    const parserId = this._definition.cruxIfAny || this._definition.id // todo: cleanup
    return `${parserId}: ${this.getRequiredCellTypeIds().join(" ")}${catchAllCellTypeId ? ` ${catchAllCellTypeId}...` : ""}`
  }

  protected _definition: AbstractParserDefinitionParser

  private _requiredCellTypeIds: string[]
  getRequiredCellTypeIds(): particlesTypes.cellTypeId[] {
    if (!this._requiredCellTypeIds) {
      const parameters = this._definition._getFromExtended(ParsersConstants.cells)
      this._requiredCellTypeIds = parameters ? parameters.split(" ") : []
    }
    return this._requiredCellTypeIds
  }

  protected _getCellTypeId(cellIndex: particlesTypes.int, requiredCellTypeIds: string[], totalWordCount: particlesTypes.int) {
    return requiredCellTypeIds[cellIndex]
  }

  protected _isCatchAllCell(cellIndex: particlesTypes.int, numberOfRequiredCells: particlesTypes.int, totalWordCount: particlesTypes.int) {
    return cellIndex >= numberOfRequiredCells
  }

  getCellArray(particle: ParserBackedParticle = undefined): AbstractParsersBackedCell<any>[] {
    const wordCount = particle ? particle.words.length : 0
    const def = this._definition
    const parsersProgram = def.languageDefinitionProgram
    const requiredCellTypeIds = this.getRequiredCellTypeIds()
    const numberOfRequiredCells = requiredCellTypeIds.length

    const actualWordCountOrRequiredCellCount = Math.max(wordCount, numberOfRequiredCells)
    const cells: AbstractParsersBackedCell<any>[] = []

    // A for loop instead of map because "numberOfCellsToFill" can be longer than words.length
    for (let cellIndex = 0; cellIndex < actualWordCountOrRequiredCellCount; cellIndex++) {
      const isCatchAll = this._isCatchAllCell(cellIndex, numberOfRequiredCells, wordCount)

      let cellTypeId = isCatchAll ? this.catchAllCellTypeId : this._getCellTypeId(cellIndex, requiredCellTypeIds, wordCount)

      let cellTypeDefinition = parsersProgram.getCellTypeDefinitionById(cellTypeId)

      let cellConstructor
      if (cellTypeDefinition) cellConstructor = cellTypeDefinition.getCellConstructor()
      else if (cellTypeId) cellConstructor = ParsersUnknownCellTypeCell
      else {
        cellConstructor = ParsersExtraWordCellTypeCell
        cellTypeId = PreludeCellTypeIds.extraWordCell
        cellTypeDefinition = parsersProgram.getCellTypeDefinitionById(cellTypeId)
      }

      const anyCellConstructor = <any>cellConstructor
      cells[cellIndex] = new anyCellConstructor(particle, cellIndex, cellTypeDefinition, cellTypeId, isCatchAll, def)
    }
    return cells
  }
}

class PrefixCellParser extends AbstractCellParser {}

class PostfixCellParser extends AbstractCellParser {
  protected _isCatchAllCell(cellIndex: particlesTypes.int, numberOfRequiredCells: particlesTypes.int, totalWordCount: particlesTypes.int) {
    return cellIndex < totalWordCount - numberOfRequiredCells
  }

  protected _getCellTypeId(cellIndex: particlesTypes.int, requiredCellTypeIds: string[], totalWordCount: particlesTypes.int) {
    const catchAllWordCount = Math.max(totalWordCount - requiredCellTypeIds.length, 0)
    return requiredCellTypeIds[cellIndex - catchAllWordCount]
  }
}

class OmnifixCellParser extends AbstractCellParser {
  getCellArray(particle: ParserBackedParticle = undefined): AbstractParsersBackedCell<any>[] {
    const cells: AbstractParsersBackedCell<any>[] = []
    const def = this._definition
    const program = <ParserBackedParticle>(particle ? particle.root : undefined)
    const parsersProgram = def.languageDefinitionProgram
    const words = particle ? particle.words : []
    const requiredCellTypeDefs = this.getRequiredCellTypeIds().map(cellTypeId => parsersProgram.getCellTypeDefinitionById(cellTypeId))
    const catchAllCellTypeId = this.catchAllCellTypeId
    const catchAllCellTypeDef = catchAllCellTypeId && parsersProgram.getCellTypeDefinitionById(catchAllCellTypeId)

    words.forEach((word, wordIndex) => {
      let cellConstructor: any
      for (let index = 0; index < requiredCellTypeDefs.length; index++) {
        const cellTypeDefinition = requiredCellTypeDefs[index]
        if (cellTypeDefinition.isValid(word, program)) {
          // todo: cleanup cellIndex/wordIndex stuff
          cellConstructor = cellTypeDefinition.getCellConstructor()
          cells.push(new cellConstructor(particle, wordIndex, cellTypeDefinition, cellTypeDefinition.id, false, def))
          requiredCellTypeDefs.splice(index, 1)
          return true
        }
      }
      if (catchAllCellTypeDef && catchAllCellTypeDef.isValid(word, program)) {
        cellConstructor = catchAllCellTypeDef.getCellConstructor()
        cells.push(new cellConstructor(particle, wordIndex, catchAllCellTypeDef, catchAllCellTypeId, true, def))
        return true
      }
      cells.push(new ParsersUnknownCellTypeCell(particle, wordIndex, undefined, undefined, false, def))
    })
    const wordCount = words.length
    requiredCellTypeDefs.forEach((cellTypeDef, index) => {
      let cellConstructor: any = cellTypeDef.getCellConstructor()
      cells.push(new cellConstructor(particle, wordCount + index, cellTypeDef, cellTypeDef.id, false, def))
    })

    return cells
  }
}

class ParsersExampleParser extends Particle {}

class ParsersCompilerParser extends Particle {
  createParserCombinator() {
    const types = [
      ParsersConstantsCompiler.stringTemplate,
      ParsersConstantsCompiler.indentCharacter,
      ParsersConstantsCompiler.catchAllCellDelimiter,
      ParsersConstantsCompiler.joinChildrenWith,
      ParsersConstantsCompiler.openChildren,
      ParsersConstantsCompiler.closeChildren
    ]
    const map: particlesTypes.firstWordToParserMap = {}
    types.forEach(type => {
      map[type] = Particle
    })
    return new Particle.ParserCombinator(undefined, map)
  }
}

abstract class AbstractParserConstantParser extends Particle {
  constructor(children?: particlesTypes.children, line?: string, parent?: Particle) {
    super(children, line, parent)
    parent[this.identifier] = this.constantValue
  }

  getGetter() {
    return `get ${this.identifier}() { return ${this.constantValueAsJsText} }`
  }

  get identifier() {
    return this.getWord(1)
  }

  get constantValueAsJsText() {
    const words = this.getWordsFrom(2)
    return words.length > 1 ? `[${words.join(",")}]` : words[0]
  }

  get constantValue() {
    return JSON.parse(this.constantValueAsJsText)
  }
}

class ParsersParserConstantInt extends AbstractParserConstantParser {}
class ParsersParserConstantString extends AbstractParserConstantParser {
  get constantValueAsJsText() {
    return "`" + Utils.escapeBackTicks(this.constantValue) + "`"
  }

  get constantValue() {
    return this.length ? this.childrenToString() : this.getWordsFrom(2).join(" ")
  }
}
class ParsersParserConstantFloat extends AbstractParserConstantParser {}
class ParsersParserConstantBoolean extends AbstractParserConstantParser {}

abstract class AbstractParserDefinitionParser extends AbstractExtendibleParticle {
  createParserCombinator() {
    // todo: some of these should just be on nonRootParticles
    const types = [
      ParsersConstants.popularity,
      ParsersConstants.inScope,
      ParsersConstants.cells,
      ParsersConstants.extends,
      ParsersConstants.description,
      ParsersConstants.catchAllParser,
      ParsersConstants.catchAllCellType,
      ParsersConstants.cellParser,
      ParsersConstants.extensions,
      ParsersConstants.tags,
      ParsersConstants.crux,
      ParsersConstants.cruxFromId,
      ParsersConstants.listDelimiter,
      ParsersConstants.contentKey,
      ParsersConstants.childrenKey,
      ParsersConstants.uniqueFirstWord,
      ParsersConstants.uniqueLine,
      ParsersConstants.pattern,
      ParsersConstants.baseParser,
      ParsersConstants.required,
      ParsersConstants.root,
      ParsersConstants._rootNodeJsHeader,
      ParsersConstants.javascript,
      ParsersConstants.compilesTo,
      ParsersConstants.javascript,
      ParsersConstants.single,
      ParsersConstants.comment
    ]

    const map: particlesTypes.firstWordToParserMap = {}
    types.forEach(type => {
      map[type] = Particle
    })
    map[ParsersConstantsConstantTypes.boolean] = ParsersParserConstantBoolean
    map[ParsersConstantsConstantTypes.int] = ParsersParserConstantInt
    map[ParsersConstantsConstantTypes.string] = ParsersParserConstantString
    map[ParsersConstantsConstantTypes.float] = ParsersParserConstantFloat
    map[ParsersConstants.compilerParser] = ParsersCompilerParser
    map[ParsersConstants.example] = ParsersExampleParser
    return new Particle.ParserCombinator(undefined, map, [{ regex: HandParsersProgram.parserFullRegex, parser: parserDefinitionParser }])
  }

  toTypeScriptInterface(used = new Set<string>()) {
    let childrenInterfaces: string[] = []
    let properties: string[] = []
    const inScope = this.firstWordMapWithDefinitions
    const thisId = this.id

    used.add(thisId)
    Object.keys(inScope).forEach(key => {
      const def = inScope[key]
      const map = def.firstWordMapWithDefinitions
      const id = def.id
      const optionalTag = def.isRequired() ? "" : "?"
      const escapedKey = key.match(/\?/) ? `"${key}"` : key
      const description = def.description
      if (Object.keys(map).length && !used.has(id)) {
        childrenInterfaces.push(def.toTypeScriptInterface(used))
        properties.push(` ${escapedKey}${optionalTag}: ${id}`)
      } else properties.push(` ${escapedKey}${optionalTag}: any${description ? " // " + description : ""}`)
    })

    properties.sort()
    const description = this.description

    const myInterface = ""
    return `${childrenInterfaces.join("\n")}
${description ? "// " + description : ""}
interface ${thisId} {
${properties.join("\n")}
}`.trim()
  }

  get id() {
    return this.getWord(0)
  }

  get idWithoutSuffix() {
    return this.id.replace(HandParsersProgram.parserSuffixRegex, "")
  }

  get constantsObject() {
    const obj = this._getUniqueConstantParticles()
    Object.keys(obj).forEach(key => (obj[key] = obj[key].constantValue))
    return obj
  }

  _getUniqueConstantParticles(extended = true) {
    const obj: { [key: string]: AbstractParserConstantParser } = {}
    const items = extended ? this._getChildrenByParserInExtended(AbstractParserConstantParser) : this.getChildrenByParser(AbstractParserConstantParser)
    items.reverse() // Last definition wins.
    items.forEach((particle: AbstractParserConstantParser) => (obj[particle.identifier] = particle))
    return obj
  }

  get examples(): ParsersExampleParser[] {
    return this._getChildrenByParserInExtended(ParsersExampleParser)
  }

  get parserIdFromDefinition(): particlesTypes.parserId {
    return this.getWord(0)
  }

  // todo: remove? just reused parserId
  get generatedClassName() {
    return this.parserIdFromDefinition
  }

  _hasValidParserId() {
    return !!this.generatedClassName
  }

  _isAbstract() {
    return this.id.startsWith(ParsersConstants.abstractParserPrefix)
  }

  get cruxIfAny(): string {
    return this.get(ParsersConstants.crux) || (this._hasFromExtended(ParsersConstants.cruxFromId) ? this.idWithoutSuffix : undefined)
  }

  get regexMatch() {
    return this.get(ParsersConstants.pattern)
  }

  get firstCellEnumOptions() {
    const firstCellDef = this._getMyCellTypeDefs()[0]
    return firstCellDef ? firstCellDef._getEnumOptions() : undefined
  }

  get languageDefinitionProgram(): HandParsersProgram {
    return <HandParsersProgram>this.root
  }

  protected get customJavascriptMethods(): particlesTypes.javascriptCode {
    const hasJsCode = this.has(ParsersConstants.javascript)
    return hasJsCode ? this.getParticle(ParsersConstants.javascript).childrenToString() : ""
  }

  private _cache_firstWordToParticleDefMap: { [firstWord: string]: parserDefinitionParser }

  get firstWordMapWithDefinitions() {
    if (!this._cache_firstWordToParticleDefMap) this._cache_firstWordToParticleDefMap = this._createParserInfo(this._getInScopeParserIds()).firstWordMap
    return this._cache_firstWordToParticleDefMap
  }

  // todo: remove
  get runTimeFirstWordsInScope(): particlesTypes.parserId[] {
    return this._getParser().getFirstWordOptions()
  }

  private _getMyCellTypeDefs() {
    const requiredCells = this.get(ParsersConstants.cells)
    if (!requiredCells) return []
    const parsersProgram = this.languageDefinitionProgram
    return requiredCells.split(" ").map(cellTypeId => {
      const cellTypeDef = parsersProgram.getCellTypeDefinitionById(cellTypeId)
      if (!cellTypeDef) throw new Error(`No cellType "${cellTypeId}" found`)
      return cellTypeDef
    })
  }

  // todo: what happens when you have a cell getter and constant with same name?
  private get cellGettersAndParserConstants() {
    // todo: add cellType parsings
    const parsersProgram = this.languageDefinitionProgram
    const getters = this._getMyCellTypeDefs().map((cellTypeDef, index) => cellTypeDef.getGetter(index))

    const catchAllCellTypeId = this.get(ParsersConstants.catchAllCellType)
    if (catchAllCellTypeId) getters.push(parsersProgram.getCellTypeDefinitionById(catchAllCellTypeId).getCatchAllGetter(getters.length))

    // Constants
    Object.values(this._getUniqueConstantParticles(false)).forEach(particle => getters.push(particle.getGetter()))

    return getters.join("\n")
  }

  protected _createParserInfo(parserIdsInScope: particlesTypes.parserId[]): parserInfo {
    const result: parserInfo = {
      firstWordMap: {},
      regexTests: []
    }

    if (!parserIdsInScope.length) return result

    const allProgramParserDefinitionsMap = this.programParserDefinitionCache
    Object.keys(allProgramParserDefinitionsMap)
      .filter(parserId => {
        const def = allProgramParserDefinitionsMap[parserId]
        return def.isOrExtendsAParserInScope(parserIdsInScope) && !def._isAbstract()
      })
      .forEach(parserId => {
        const def = allProgramParserDefinitionsMap[parserId]
        const regex = def.regexMatch
        const crux = def.cruxIfAny
        const enumOptions = def.firstCellEnumOptions
        if (regex) result.regexTests.push({ regex: regex, parser: def.parserIdFromDefinition })
        else if (crux) result.firstWordMap[crux] = def
        else if (enumOptions) {
          enumOptions.forEach(option => (result.firstWordMap[option] = def))
        }
      })
    return result
  }

  get topParserDefinitions(): parserDefinitionParser[] {
    const arr = Object.values(this.firstWordMapWithDefinitions)
    arr.sort(Utils.makeSortByFn((definition: parserDefinitionParser) => definition.popularity))
    arr.reverse()
    return arr
  }

  _getMyInScopeParserIds(target: AbstractParserDefinitionParser = this): particlesTypes.parserId[] {
    const parsersParticle = target.getParticle(ParsersConstants.inScope)
    const scopedDefinitionIds = target.myScopedParserDefinitions.map(def => def.id)
    return parsersParticle ? parsersParticle.getWordsFrom(1).concat(scopedDefinitionIds) : scopedDefinitionIds
  }

  protected _getInScopeParserIds(): particlesTypes.parserId[] {
    // todo: allow multiple of these if we allow mixins?
    const ids = this._getMyInScopeParserIds()
    const parentDef = this._getExtendedParent()
    return parentDef ? ids.concat((<AbstractParserDefinitionParser>parentDef)._getInScopeParserIds()) : ids
  }

  get isSingle() {
    const hit = this._getParticleFromExtended(ParsersConstants.single)
    return hit && hit.get(ParsersConstants.single) !== "false"
  }

  get isUniqueLine() {
    const hit = this._getParticleFromExtended(ParsersConstants.uniqueLine)
    return hit && hit.get(ParsersConstants.uniqueLine) !== "false"
  }

  isRequired(): boolean {
    return this._hasFromExtended(ParsersConstants.required)
  }

  getParserDefinitionByParserId(parserId: particlesTypes.parserId): AbstractParserDefinitionParser {
    // todo: return catch all?
    const def = this.programParserDefinitionCache[parserId]
    if (def) return def
    this.languageDefinitionProgram._addDefaultCatchAllBlobParser() // todo: cleanup. Why did I do this? Needs to be removed or documented.
    const particleDef = this.languageDefinitionProgram.programParserDefinitionCache[parserId]
    if (!particleDef) throw new Error(`No definition found for parser id "${parserId}". Particle: \n---\n${this.asString}\n---`)
    return particleDef
  }

  isDefined(parserId: string) {
    return !!this.programParserDefinitionCache[parserId]
  }

  get idToParticleMap() {
    return this.programParserDefinitionCache
  }

  private _cache_isRoot: boolean

  private _amIRoot(): boolean {
    if (this._cache_isRoot === undefined) this._cache_isRoot = this._languageRootParticle === this
    return this._cache_isRoot
  }

  private get _languageRootParticle() {
    return (<HandParsersProgram>this.root).rootParserDefinition
  }

  private _isErrorParser() {
    return this.get(ParsersConstants.baseParser) === ParsersConstants.errorParser
  }

  _isBlobParser() {
    // Do not check extended classes. Only do once.
    return this._getFromExtended(ParsersConstants.baseParser) === ParsersConstants.blobParser
  }

  private get errorMethodToJavascript(): particlesTypes.javascriptCode {
    if (this._isBlobParser()) return "getErrors() { return [] }" // Skips parsing child particles for perf gains.
    if (this._isErrorParser()) return "getErrors() { return this._getErrorParserErrors() }"
    return ""
  }

  private get parserAsJavascript(): particlesTypes.javascriptCode {
    if (this._isBlobParser())
      // todo: do we need this?
      return "createParserCombinator() { return new Particle.ParserCombinator(this._getBlobParserCatchAllParser())}"
    const parserInfo = this._createParserInfo(this._getMyInScopeParserIds())
    const myFirstWordMap = parserInfo.firstWordMap
    const regexRules = parserInfo.regexTests

    // todo: use constants in first word maps?
    // todo: cache the super extending?
    const firstWords = Object.keys(myFirstWordMap)
    const hasFirstWords = firstWords.length
    const catchAllParser = this.catchAllParserToJavascript
    if (!hasFirstWords && !catchAllParser && !regexRules.length) return ""

    const firstWordsStr = hasFirstWords
      ? `Object.assign(Object.assign({}, super.createParserCombinator()._getFirstWordMapAsObject()), {` + firstWords.map(firstWord => `"${firstWord}" : ${myFirstWordMap[firstWord].parserIdFromDefinition}`).join(",\n") + "})"
      : "undefined"

    const regexStr = regexRules.length
      ? `[${regexRules
          .map(rule => {
            return `{regex: /${rule.regex}/, parser: ${rule.parser}}`
          })
          .join(",")}]`
      : "undefined"

    const catchAllStr = catchAllParser ? catchAllParser : this._amIRoot() ? `this._getBlobParserCatchAllParser()` : "undefined"

    const scopedParserJavascript = this.myScopedParserDefinitions.map(def => def.asJavascriptClass).join("\n\n")

    return `createParserCombinator() {${scopedParserJavascript}
  return new Particle.ParserCombinator(${catchAllStr}, ${firstWordsStr}, ${regexStr})
  }`
  }

  private get myScopedParserDefinitions() {
    return <parserDefinitionParser[]>this.getChildrenByParser(parserDefinitionParser)
  }

  private get catchAllParserToJavascript(): particlesTypes.javascriptCode {
    if (this._isBlobParser()) return "this._getBlobParserCatchAllParser()"
    const parserId = this.get(ParsersConstants.catchAllParser)
    if (!parserId) return ""
    const particleDef = this.getParserDefinitionByParserId(parserId)
    return particleDef.generatedClassName
  }

  get asJavascriptClass(): particlesTypes.javascriptCode {
    const components = [this.parserAsJavascript, this.errorMethodToJavascript, this.cellGettersAndParserConstants, this.customJavascriptMethods].filter(identity => identity)
    const thisClassName = this.generatedClassName

    if (this._amIRoot()) {
      components.push(`static cachedHandParsersProgramRoot = new HandParsersProgram(\`${Utils.escapeBackTicks(this.parent.toString().replace(/\\/g, "\\\\"))}\`)
        get handParsersProgram() {
          return this.constructor.cachedHandParsersProgramRoot
      }`)

      components.push(`static rootParser = ${thisClassName}`)
    }

    return `class ${thisClassName} extends ${this._getExtendsClassName()} {
      ${components.join("\n")}
    }`
  }

  private _getExtendsClassName() {
    const extendedDef = <AbstractParserDefinitionParser>this._getExtendedParent()
    return extendedDef ? extendedDef.generatedClassName : "ParserBackedParticle"
  }

  _getCompilerObject(): particlesTypes.stringMap {
    let obj: { [key: string]: string } = {}
    const items = this._getChildrenByParserInExtended(ParsersCompilerParser)
    items.reverse() // Last definition wins.
    items.forEach((particle: ParsersCompilerParser) => {
      obj = Object.assign(obj, particle.toObject()) // todo: what about multiline strings?
    })
    return obj
  }

  // todo: improve layout (use bold?)
  get lineHints() {
    return this.cellParser.lineHints
  }

  isOrExtendsAParserInScope(firstWordsInScope: string[]): boolean {
    const chain = this._getParserInheritanceSet()
    return firstWordsInScope.some(firstWord => chain.has(firstWord))
  }

  isTerminalParser() {
    return !this._getFromExtended(ParsersConstants.inScope) && !this._getFromExtended(ParsersConstants.catchAllParser)
  }

  private get sublimeMatchLine() {
    const regexMatch = this.regexMatch
    if (regexMatch) return `'${regexMatch}'`
    const cruxMatch = this.cruxIfAny
    if (cruxMatch) return `'^ *${Utils.escapeRegExp(cruxMatch)}(?: |$)'`
    const enumOptions = this.firstCellEnumOptions
    if (enumOptions) return `'^ *(${Utils.escapeRegExp(enumOptions.join("|"))})(?: |$)'`
  }

  // todo: refactor. move some parts to cellParser?
  _toSublimeMatchBlock() {
    const defaultPaint = "source"
    const program = this.languageDefinitionProgram
    const cellParser = this.cellParser
    const requiredCellTypeIds = cellParser.getRequiredCellTypeIds()
    const catchAllCellTypeId = cellParser.catchAllCellTypeId
    const firstCellTypeDef = program.getCellTypeDefinitionById(requiredCellTypeIds[0])
    const firstWordPaint = (firstCellTypeDef ? firstCellTypeDef.paint : defaultPaint) + "." + this.parserIdFromDefinition
    const topHalf = ` '${this.parserIdFromDefinition}':
  - match: ${this.sublimeMatchLine}
    scope: ${firstWordPaint}`
    if (catchAllCellTypeId) requiredCellTypeIds.push(catchAllCellTypeId)
    if (!requiredCellTypeIds.length) return topHalf
    const captures = requiredCellTypeIds
      .map((cellTypeId, index) => {
        const cellTypeDefinition = program.getCellTypeDefinitionById(cellTypeId) // todo: cleanup
        if (!cellTypeDefinition) throw new Error(`No ${ParsersConstants.cellType} ${cellTypeId} found`) // todo: standardize error/capture error at parsers time
        return `        ${index + 1}: ${(cellTypeDefinition.paint || defaultPaint) + "." + cellTypeDefinition.cellTypeId}`
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

  private _cache_parserInheritanceSet: Set<particlesTypes.parserId>
  private _cache_ancestorParserIdsArray: particlesTypes.parserId[]

  _getParserInheritanceSet() {
    if (!this._cache_parserInheritanceSet) this._cache_parserInheritanceSet = new Set(this.ancestorParserIdsArray)
    return this._cache_parserInheritanceSet
  }

  get ancestorParserIdsArray(): particlesTypes.parserId[] {
    if (!this._cache_ancestorParserIdsArray) {
      this._cache_ancestorParserIdsArray = this._getAncestorsArray().map(def => (<AbstractParserDefinitionParser>def).parserIdFromDefinition)
      this._cache_ancestorParserIdsArray.reverse()
    }
    return this._cache_ancestorParserIdsArray
  }

  protected _cache_parserDefinitionParsers: { [parserId: string]: parserDefinitionParser }
  get programParserDefinitionCache() {
    if (!this._cache_parserDefinitionParsers) this._cache_parserDefinitionParsers = this.isRoot || this.hasParserDefinitions ? this.makeProgramParserDefinitionCache() : this.parent.programParserDefinitionCache
    return this._cache_parserDefinitionParsers
  }

  get hasParserDefinitions() {
    return !!this.getChildrenByParser(parserDefinitionParser).length
  }

  makeProgramParserDefinitionCache() {
    const scopedParsers = this.getChildrenByParser(parserDefinitionParser)
    const cache = Object.assign({}, this.parent.programParserDefinitionCache) // todo. We don't really need this. we should just lookup the parent if no local hits.
    scopedParsers.forEach(parserDefinitionParser => (cache[(<parserDefinitionParser>parserDefinitionParser).parserIdFromDefinition] = parserDefinitionParser))
    return cache
  }

  get description(): string {
    return this._getFromExtended(ParsersConstants.description) || ""
  }

  get popularity() {
    const val = this._getFromExtended(ParsersConstants.popularity)
    return val ? parseFloat(val) : 0
  }

  private _getExtendedParserId(): particlesTypes.parserId {
    const ancestorIds = this.ancestorParserIdsArray
    if (ancestorIds.length > 1) return ancestorIds[ancestorIds.length - 2]
  }

  protected _toStumpString() {
    const crux = this.cruxIfAny
    const cellArray = this.cellParser.getCellArray().filter((item, index) => index) // for now this only works for keyword langs
    if (!cellArray.length)
      // todo: remove this! just doing it for now until we refactor getCellArray to handle catchAlls better.
      return ""
    const cells = new Particle(cellArray.map((cell, index) => cell._toStumpInput(crux)).join("\n"))
    return `div
 label ${crux}
${cells.toString(1)}`
  }

  toStumpString() {
    const particleBreakSymbol = "\n"
    return this._getConcreteNonErrorInScopeParticleDefinitions(this._getInScopeParserIds())
      .map(def => def._toStumpString())
      .filter(identity => identity)
      .join(particleBreakSymbol)
  }

  private _generateSimulatedLine(seed: number): string {
    // todo: generate simulated data from catch all
    const crux = this.cruxIfAny
    return this.cellParser
      .getCellArray()
      .map((cell, index) => (!index && crux ? crux : cell.synthesizeCell(seed)))
      .join(" ")
  }

  private _shouldSynthesize(def: AbstractParserDefinitionParser, parserChain: string[]) {
    if (def._isErrorParser() || def._isAbstract()) return false
    if (parserChain.includes(def.id)) return false
    const tags = def.get(ParsersConstants.tags)
    if (tags && tags.includes(ParsersConstantsMisc.doNotSynthesize)) return false
    return true
  }

  // Get all definitions in this current scope down, even ones that are scoped inside other definitions.
  get inScopeAndDescendantDefinitions() {
    return this.languageDefinitionProgram._collectAllDefinitions(Object.values(this.programParserDefinitionCache), [])
  }

  private _collectAllDefinitions(defs: parserDefinitionParser[], collection: parserDefinitionParser[] = []) {
    defs.forEach((def: parserDefinitionParser) => {
      collection.push(def)
      def._collectAllDefinitions(def.getChildrenByParser(parserDefinitionParser), collection)
    })
    return collection
  }

  get cruxPath() {
    const parentPath = this.parent.cruxPath
    return (parentPath ? parentPath + " " : "") + this.cruxIfAny
  }

  get cruxPathAsColumnName() {
    return this.cruxPath.replace(/ /g, "_")
  }

  // Get every definition that extends from this one, even ones that are scoped inside other definitions.
  get concreteDescendantDefinitions() {
    const { inScopeAndDescendantDefinitions, id } = this
    return Object.values(inScopeAndDescendantDefinitions).filter(def => def._doesExtend(id) && !def._isAbstract())
  }

  get concreteInScopeDescendantDefinitions() {
    // Note: non-recursive.
    const defs = this.programParserDefinitionCache
    const id = this.id
    return Object.values(defs).filter(def => def._doesExtend(id) && !def._isAbstract())
  }

  private _getConcreteNonErrorInScopeParticleDefinitions(parserIds: string[]) {
    const defs: AbstractParserDefinitionParser[] = []
    parserIds.forEach(parserId => {
      const def = this.getParserDefinitionByParserId(parserId)
      if (def._isErrorParser()) return
      else if (def._isAbstract()) def.concreteInScopeDescendantDefinitions.forEach(def => defs.push(def))
      else defs.push(def)
    })
    return defs
  }

  // todo: refactor
  synthesizeParticle(particleCount = 1, indentCount = -1, parsersAlreadySynthesized: string[] = [], seed = Date.now()) {
    let inScopeParserIds = this._getInScopeParserIds()
    const catchAllParserId = this._getFromExtended(ParsersConstants.catchAllParser)
    if (catchAllParserId) inScopeParserIds.push(catchAllParserId)
    const thisId = this.id
    if (!parsersAlreadySynthesized.includes(thisId)) parsersAlreadySynthesized.push(thisId)
    const lines = []
    while (particleCount) {
      const line = this._generateSimulatedLine(seed)
      if (line) lines.push(" ".repeat(indentCount >= 0 ? indentCount : 0) + line)

      this._getConcreteNonErrorInScopeParticleDefinitions(inScopeParserIds.filter(parserId => !parsersAlreadySynthesized.includes(parserId)))
        .filter(def => this._shouldSynthesize(def, parsersAlreadySynthesized))
        .forEach(def => {
          const chain = parsersAlreadySynthesized // .slice(0)
          chain.push(def.id)
          def.synthesizeParticle(1, indentCount + 1, chain, seed).forEach(line => lines.push(line))
        })
      particleCount--
    }
    return lines
  }

  private _cellParser: AbstractCellParser

  get cellParser() {
    if (!this._cellParser) {
      const cellParsingStrategy = this._getFromExtended(ParsersConstants.cellParser)
      if (cellParsingStrategy === ParsersCellParser.postfix) this._cellParser = new PostfixCellParser(this)
      else if (cellParsingStrategy === ParsersCellParser.omnifix) this._cellParser = new OmnifixCellParser(this)
      else this._cellParser = new PrefixCellParser(this)
    }
    return this._cellParser
  }
}

// todo: remove?
class parserDefinitionParser extends AbstractParserDefinitionParser {}

// HandParsersProgram is a constructor that takes a parsers file, and builds a new
// constructor for new language that takes files in that language to execute, compile, etc.
class HandParsersProgram extends AbstractParserDefinitionParser {
  createParserCombinator() {
    const map: particlesTypes.stringMap = {}
    map[ParsersConstants.comment] = Particle
    return new Particle.ParserCombinator(UnknownParserParticle, map, [
      { regex: HandParsersProgram.blankLineRegex, parser: Particle },
      { regex: HandParsersProgram.parserFullRegex, parser: parserDefinitionParser },
      { regex: HandParsersProgram.cellTypeFullRegex, parser: cellTypeDefinitionParser }
    ])
  }

  static makeParserId = (str: string) => Utils._replaceNonAlphaNumericCharactersWithCharCodes(str).replace(HandParsersProgram.parserSuffixRegex, "") + ParsersConstants.parserSuffix
  static makeCellTypeId = (str: string) => Utils._replaceNonAlphaNumericCharactersWithCharCodes(str).replace(HandParsersProgram.cellTypeSuffixRegex, "") + ParsersConstants.cellTypeSuffix

  static parserSuffixRegex = new RegExp(ParsersConstants.parserSuffix + "$")
  static parserFullRegex = new RegExp("^[a-zA-Z0-9_]+" + ParsersConstants.parserSuffix + "$")
  static blankLineRegex = new RegExp("^$")

  static cellTypeSuffixRegex = new RegExp(ParsersConstants.cellTypeSuffix + "$")
  static cellTypeFullRegex = new RegExp("^[a-zA-Z0-9_]+" + ParsersConstants.cellTypeSuffix + "$")

  private _cache_rootParser: any
  // rootParser
  // Note: this is some so far unavoidable tricky code. We need to eval the transpiled JS, in a NodeJS or browser environment.
  _compileAndReturnRootParser(): Function {
    if (this._cache_rootParser) return this._cache_rootParser

    if (!this.isNodeJs()) {
      this._cache_rootParser = Utils.appendCodeAndReturnValueOnWindow(this.toBrowserJavascript(), this.rootParserId).rootParser
      return this._cache_rootParser
    }

    const path = require("path")
    const code = this.toNodeJsJavascript(__dirname)
    try {
      const rootParticle = this._requireInVmNodeJsRootParser(code)
      this._cache_rootParser = rootParticle.rootParser
      if (!this._cache_rootParser) throw new Error(`Failed to rootParser`)
    } catch (err) {
      // todo: figure out best error pattern here for debugging
      console.log(err)
      // console.log(`Error in code: `)
      // console.log(new Particle(code).toStringWithLineNumbers())
    }
    return this._cache_rootParser
  }

  get cruxPath() {
    return ""
  }

  trainModel(programs: string[], rootParser = this.compileAndReturnRootParser()): SimplePredictionModel {
    const particleDefs = this.validConcreteAndAbstractParserDefinitions
    const particleDefCountIncludingRoot = particleDefs.length + 1
    const matrix = Utils.makeMatrix(particleDefCountIncludingRoot, particleDefCountIncludingRoot, 0)
    const idToIndex: { [id: string]: number } = {}
    const indexToId: { [index: number]: string } = {}
    particleDefs.forEach((def, index) => {
      const id = def.id
      idToIndex[id] = index + 1
      indexToId[index + 1] = id
    })
    programs.forEach(code => {
      const exampleProgram = new rootParser(code)
      exampleProgram.topDownArray.forEach((particle: ParserBackedParticle) => {
        const particleIndex = idToIndex[particle.definition.id]
        const parentParticle = <ParserBackedParticle>particle.parent
        if (!particleIndex) return undefined
        if (parentParticle.isRoot()) matrix[0][particleIndex]++
        else {
          const parentIndex = idToIndex[parentParticle.definition.id]
          if (!parentIndex) return undefined
          matrix[parentIndex][particleIndex]++
        }
      })
    })
    return {
      idToIndex,
      indexToId,
      matrix
    }
  }

  private _mapPredictions(predictionsVector: number[], model: SimplePredictionModel) {
    const total = Utils.sum(predictionsVector)
    const predictions = predictionsVector.slice(1).map((count, index) => {
      const id = model.indexToId[index + 1]
      return {
        id,
        def: this.getParserDefinitionByParserId(id),
        count,
        prob: count / total
      }
    })
    predictions.sort(Utils.makeSortByFn((prediction: any) => prediction.count)).reverse()
    return predictions
  }

  predictChildren(model: SimplePredictionModel, particle: ParserBackedParticle) {
    return this._mapPredictions(this._predictChildren(model, particle), model)
  }

  predictParents(model: SimplePredictionModel, particle: ParserBackedParticle) {
    return this._mapPredictions(this._predictParents(model, particle), model)
  }

  private _predictChildren(model: SimplePredictionModel, particle: ParserBackedParticle) {
    return model.matrix[particle.isRoot() ? 0 : model.idToIndex[particle.definition.id]]
  }

  private _predictParents(model: SimplePredictionModel, particle: ParserBackedParticle) {
    if (particle.isRoot()) return []
    const particleIndex = model.idToIndex[particle.definition.id]
    return model.matrix.map(row => row[particleIndex])
  }

  // todo: hacky, remove
  private _dirName: string
  _setDirName(name: string) {
    this._dirName = name
    return this
  }

  private _requireInVmNodeJsRootParser(code: particlesTypes.javascriptCode): any {
    const vm = require("vm")
    const path = require("path")
    // todo: cleanup up
    try {
      Object.keys(GlobalNamespaceAdditions).forEach(key => {
        ;(<any>global)[key] = require("./" + GlobalNamespaceAdditions[key])
      })
      ;(<any>global).require = require
      ;(<any>global).__dirname = this._dirName
      ;(<any>global).module = {}
      return vm.runInThisContext(code)
    } catch (err) {
      // todo: figure out best error pattern here for debugging
      console.log(`Error in compiled parsers code for language "${this.parsersName}"`)
      // console.log(new Particle(code).toStringWithLineNumbers())
      console.log(err)
      throw err
    }
  }

  examplesToTestBlocks(rootParser = this.compileAndReturnRootParser(), expectedErrorMessage = "") {
    const testBlocks: { [id: string]: Function } = {}
    this.validConcreteAndAbstractParserDefinitions.forEach(def =>
      def.examples.forEach(example => {
        const id = def.id + example.content
        testBlocks[id] = (equal: Function) => {
          const exampleProgram = new rootParser(example.childrenToString())
          const errors = exampleProgram.getAllErrors(example._getLineNumber() + 1)
          equal(errors.join("\n"), expectedErrorMessage, `Expected no errors in ${id}`)
        }
      })
    )
    return testBlocks
  }

  toReadMe() {
    const languageName = this.extensionName
    const rootParticleDef = this.rootParserDefinition
    const cellTypes = this.cellTypeDefinitions
    const parserLineage = this.parserLineage
    const exampleParticle = rootParticleDef.examples[0]
    return `title2 ${languageName} stats

list
 - ${languageName} has ${parserLineage.topDownArray.length} parsers.
 - ${languageName} has ${Object.keys(cellTypes).length} cell types.
 - The source code for ${languageName} is ${this.topDownArray.length} lines long.
`
  }

  toBundle() {
    const files: particlesTypes.stringMap = {}
    const rootParticleDef = this.rootParserDefinition
    const languageName = this.extensionName
    const example = rootParticleDef.examples[0]
    const sampleCode = example ? example.childrenToString() : ""

    files[ParsersBundleFiles.package] = JSON.stringify(
      {
        name: languageName,
        private: true,
        dependencies: {
          scrollsdk: Particle.getVersion()
        }
      },
      null,
      2
    )
    files[ParsersBundleFiles.readme] = this.toReadMe()

    const testCode = `const program = new ${languageName}(sampleCode)
const errors = program.getAllErrors()
console.log("Sample program compiled with " + errors.length + " errors.")
if (errors.length)
 console.log(errors.map(error => error.message))`

    const nodePath = `${languageName}.node.js`
    files[nodePath] = this.toNodeJsJavascript()
    files[ParsersBundleFiles.indexJs] = `module.exports = require("./${nodePath}")`

    const browserPath = `${languageName}.browser.js`
    files[browserPath] = this.toBrowserJavascript()
    files[ParsersBundleFiles.indexHtml] = `<script src="node_modules/scrollsdk/products/Utils.browser.js"></script>
<script src="node_modules/scrollsdk/products/Particle.browser.js"></script>
<script src="node_modules/scrollsdk/products/Parsers.ts.browser.js"></script>
<script src="${browserPath}"></script>
<script>
const sampleCode = \`${sampleCode.toString()}\`
${testCode}
</script>`

    const samplePath = "sample." + this.extensionName
    files[samplePath] = sampleCode.toString()
    files[ParsersBundleFiles.testJs] = `const ${languageName} = require("./index.js")
/*keep-line*/ const sampleCode = require("fs").readFileSync("${samplePath}", "utf8")
${testCode}`
    return files
  }

  get targetExtension() {
    return this.rootParserDefinition.get(ParsersConstants.compilesTo)
  }

  private _cache_cellTypes: {
    [name: string]: cellTypeDefinitionParser
  }

  get cellTypeDefinitions() {
    if (this._cache_cellTypes) return this._cache_cellTypes
    const types: { [typeName: string]: cellTypeDefinitionParser } = {}
    // todo: add built in word types?
    this.getChildrenByParser(cellTypeDefinitionParser).forEach(type => (types[(<cellTypeDefinitionParser>type).cellTypeId] = type))
    this._cache_cellTypes = types
    return types
  }

  getCellTypeDefinitionById(cellTypeId: particlesTypes.cellTypeId) {
    // todo: return unknownCellTypeDefinition? or is that handled somewhere else?
    return this.cellTypeDefinitions[cellTypeId]
  }

  get parserLineage() {
    const newParticle = new Particle()
    Object.values(this.validConcreteAndAbstractParserDefinitions).forEach(particle => newParticle.touchParticle(particle.ancestorParserIdsArray.join(" ")))
    return newParticle
  }

  get languageDefinitionProgram() {
    return this
  }

  get validConcreteAndAbstractParserDefinitions() {
    return <parserDefinitionParser[]>this.getChildrenByParser(parserDefinitionParser).filter((particle: parserDefinitionParser) => particle._hasValidParserId())
  }

  private _cache_rootParserParticle: parserDefinitionParser

  private get lastRootParserDefinitionParticle() {
    return this.findLast(def => def instanceof AbstractParserDefinitionParser && def.has(ParsersConstants.root) && def._hasValidParserId())
  }

  private _initRootParserDefinitionParticle() {
    if (this._cache_rootParserParticle) return
    if (!this._cache_rootParserParticle) this._cache_rootParserParticle = this.lastRootParserDefinitionParticle
    // By default, have a very permissive basic root particle.
    // todo: whats the best design pattern to use for this sort of thing?
    if (!this._cache_rootParserParticle) {
      this._cache_rootParserParticle = <parserDefinitionParser>this.concat(`${ParsersConstants.DefaultRootParser}
 ${ParsersConstants.root}
 ${ParsersConstants.catchAllParser} ${ParsersConstants.BlobParser}`)[0]
      this._addDefaultCatchAllBlobParser()
    }
  }

  get rootParserDefinition() {
    this._initRootParserDefinitionParticle()
    return this._cache_rootParserParticle
  }

  // todo: whats the best design pattern to use for this sort of thing?
  // todo: remove this, or at least document wtf is going on
  _addedCatchAll: any
  _addDefaultCatchAllBlobParser() {
    if (this._addedCatchAll) return
    this._addedCatchAll = true
    delete this._cache_parserDefinitionParsers
    this.concat(`${ParsersConstants.BlobParser}
 ${ParsersConstants.baseParser} ${ParsersConstants.blobParser}`)
  }

  get extensionName() {
    return this.parsersName
  }

  get id() {
    return this.rootParserId
  }

  get rootParserId() {
    return this.rootParserDefinition.parserIdFromDefinition
  }

  get parsersName(): string | undefined {
    return this.rootParserId.replace(HandParsersProgram.parserSuffixRegex, "")
  }

  _getMyInScopeParserIds() {
    return super._getMyInScopeParserIds(this.rootParserDefinition)
  }

  protected _getInScopeParserIds(): particlesTypes.parserId[] {
    const parsersParticle = this.rootParserDefinition.getParticle(ParsersConstants.inScope)
    return parsersParticle ? parsersParticle.getWordsFrom(1) : []
  }

  makeProgramParserDefinitionCache() {
    const cache = {}
    this.getChildrenByParser(parserDefinitionParser).forEach(parserDefinitionParser => (cache[(<parserDefinitionParser>parserDefinitionParser).parserIdFromDefinition] = parserDefinitionParser))
    return cache
  }

  static _languages: any = {}
  static _parsers: any = {}

  // todo: add explanation
  private _cached_rootParser: AbstractRuntimeProgramConstructorInterface
  compileAndReturnRootParser() {
    if (!this._cached_rootParser) {
      const rootDef = this.rootParserDefinition
      this._cached_rootParser = <AbstractRuntimeProgramConstructorInterface>rootDef.languageDefinitionProgram._compileAndReturnRootParser()
    }
    return this._cached_rootParser
  }

  private get fileExtensions(): string {
    return this.rootParserDefinition.get(ParsersConstants.extensions) ? this.rootParserDefinition.get(ParsersConstants.extensions).split(" ").join(",") : this.extensionName
  }

  toNodeJsJavascript(scrollsdkProductsPath: particlesTypes.requirePath = "scrollsdk/products"): particlesTypes.javascriptCode {
    return this._rootParticleDefToJavascriptClass(scrollsdkProductsPath, true).trim()
  }

  toBrowserJavascript(): particlesTypes.javascriptCode {
    return this._rootParticleDefToJavascriptClass("", false).trim()
  }

  private _rootParticleDefToJavascriptClass(scrollsdkProductsPath: particlesTypes.requirePath, forNodeJs = true): particlesTypes.javascriptCode {
    const defs = this.validConcreteAndAbstractParserDefinitions
    // todo: throw if there is no root particle defined
    const parserClasses = defs.map(def => def.asJavascriptClass).join("\n\n")
    const rootDef = this.rootParserDefinition
    const rootNodeJsHeader = forNodeJs && rootDef._getConcatBlockStringFromExtended(ParsersConstants._rootNodeJsHeader)
    const rootName = rootDef.generatedClassName

    if (!rootName) throw new Error(`Root Particle Type Has No Name`)

    let exportScript = ""
    if (forNodeJs)
      exportScript = `module.exports = ${rootName};
${rootName}`
    else exportScript = `window.${rootName} = ${rootName}`

    let nodeJsImports = ``
    if (forNodeJs) {
      const path = require("path")
      nodeJsImports = Object.keys(GlobalNamespaceAdditions)
        .map(key => {
          const thePath = scrollsdkProductsPath + "/" + GlobalNamespaceAdditions[key]
          return `const { ${key} } = require("${thePath.replace(/\\/g, "\\\\")}")` // escape windows backslashes
        })
        .join("\n")
    }

    // todo: we can expose the previous "constants" export, if needed, via the parsers, which we preserve.
    return `{
${nodeJsImports}
${rootNodeJsHeader ? rootNodeJsHeader : ""}
${parserClasses}

${exportScript}
}
`
  }

  toSublimeSyntaxFile() {
    const cellTypeDefs = this.cellTypeDefinitions
    const variables = Object.keys(cellTypeDefs)
      .map(name => ` ${name}: '${cellTypeDefs[name].regexString}'`)
      .join("\n")

    const defs = this.validConcreteAndAbstractParserDefinitions.filter(kw => !kw._isAbstract())
    const parserContexts = defs.map(def => def._toSublimeMatchBlock()).join("\n\n")
    const includes = defs.map(parserDef => `  - include: '${parserDef.parserIdFromDefinition}'`).join("\n")

    return `%YAML 1.2
---
name: ${this.extensionName}
file_extensions: [${this.fileExtensions}]
scope: source.${this.extensionName}

variables:
${variables}

contexts:
 main:
${includes}

${parserContexts}`
  }
}

const PreludeKinds: particlesTypes.stringMap = {}
PreludeKinds[PreludeCellTypeIds.anyCell] = ParsersAnyCell
PreludeKinds[PreludeCellTypeIds.keywordCell] = ParsersKeywordCell
PreludeKinds[PreludeCellTypeIds.floatCell] = ParsersFloatCell
PreludeKinds[PreludeCellTypeIds.numberCell] = ParsersFloatCell
PreludeKinds[PreludeCellTypeIds.bitCell] = ParsersBitCell
PreludeKinds[PreludeCellTypeIds.boolCell] = ParsersBoolCell
PreludeKinds[PreludeCellTypeIds.intCell] = ParsersIntCell

class UnknownParsersProgram extends Particle {
  private _inferRootParticleForAPrefixLanguage(parsersName: string): Particle {
    parsersName = HandParsersProgram.makeParserId(parsersName)
    const rootParticle = new Particle(`${parsersName}
 ${ParsersConstants.root}`)

    // note: right now we assume 1 global cellTypeMap and parserMap per parsers. But we may have scopes in the future?
    const rootParticleNames = this.getFirstWords()
      .filter(identity => identity)
      .map(word => HandParsersProgram.makeParserId(word))
    rootParticle
      .particleAt(0)
      .touchParticle(ParsersConstants.inScope)
      .setWordsFrom(1, Array.from(new Set(rootParticleNames)))

    return rootParticle
  }

  private static _childSuffix = "Child"

  private _renameIntegerKeywords(clone: UnknownParsersProgram) {
    // todo: why are we doing this?
    for (let particle of clone.getTopDownArrayIterator()) {
      const firstWordIsAnInteger = !!particle.firstWord.match(/^\d+$/)
      const parentFirstWord = particle.parent.firstWord
      if (firstWordIsAnInteger && parentFirstWord) particle.setFirstWord(HandParsersProgram.makeParserId(parentFirstWord + UnknownParsersProgram._childSuffix))
    }
  }

  private _getKeywordMaps(clone: UnknownParsersProgram) {
    const keywordsToChildKeywords: { [firstWord: string]: particlesTypes.stringMap } = {}
    const keywordsToParticleInstances: { [firstWord: string]: Particle[] } = {}
    for (let particle of clone.getTopDownArrayIterator()) {
      const firstWord = particle.firstWord
      if (!keywordsToChildKeywords[firstWord]) keywordsToChildKeywords[firstWord] = {}
      if (!keywordsToParticleInstances[firstWord]) keywordsToParticleInstances[firstWord] = []
      keywordsToParticleInstances[firstWord].push(particle)
      particle.forEach((child: Particle) => (keywordsToChildKeywords[firstWord][child.firstWord] = true))
    }
    return { keywordsToChildKeywords: keywordsToChildKeywords, keywordsToParticleInstances: keywordsToParticleInstances }
  }

  private _inferParserDef(firstWord: string, globalCellTypeMap: Map<string, string>, childFirstWords: string[], instances: Particle[]) {
    const edgeSymbol = this.edgeSymbol
    const parserId = HandParsersProgram.makeParserId(firstWord)
    const particleDefParticle = <Particle>new Particle(parserId).particleAt(0)
    const childParserIds = childFirstWords.map(word => HandParsersProgram.makeParserId(word))
    if (childParserIds.length) particleDefParticle.touchParticle(ParsersConstants.inScope).setWordsFrom(1, childParserIds)

    const cellsForAllInstances = instances
      .map(line => line.content)
      .filter(identity => identity)
      .map(line => line.split(edgeSymbol))
    const instanceCellCounts = new Set(cellsForAllInstances.map(cells => cells.length))
    const maxCellsOnLine = Math.max(...Array.from(instanceCellCounts))
    const minCellsOnLine = Math.min(...Array.from(instanceCellCounts))
    let catchAllCellType: string
    let cellTypeIds = []
    for (let cellIndex = 0; cellIndex < maxCellsOnLine; cellIndex++) {
      const cellType = this._getBestCellType(
        firstWord,
        instances.length,
        maxCellsOnLine,
        cellsForAllInstances.map(cells => cells[cellIndex])
      )
      if (!globalCellTypeMap.has(cellType.cellTypeId)) globalCellTypeMap.set(cellType.cellTypeId, cellType.cellTypeDefinition)

      cellTypeIds.push(cellType.cellTypeId)
    }
    if (maxCellsOnLine > minCellsOnLine) {
      //columns = columns.slice(0, min)
      catchAllCellType = cellTypeIds.pop()
      while (cellTypeIds[cellTypeIds.length - 1] === catchAllCellType) {
        cellTypeIds.pop()
      }
    }

    const needsCruxProperty = !firstWord.endsWith(UnknownParsersProgram._childSuffix + ParsersConstants.parserSuffix) // todo: cleanup
    if (needsCruxProperty) particleDefParticle.set(ParsersConstants.crux, firstWord)

    if (catchAllCellType) particleDefParticle.set(ParsersConstants.catchAllCellType, catchAllCellType)

    const cellLine = cellTypeIds.slice()
    cellLine.unshift(PreludeCellTypeIds.keywordCell)
    if (cellLine.length > 0) particleDefParticle.set(ParsersConstants.cells, cellLine.join(edgeSymbol))

    //if (!catchAllCellType && cellTypeIds.length === 1) particleDefParticle.set(ParsersConstants.cells, cellTypeIds[0])

    // Todo: add conditional frequencies
    return particleDefParticle.parent.toString()
  }

  //  inferParsersFileForAnSSVLanguage(parsersName: string): string {
  //     parsersName = HandParsersProgram.makeParserId(parsersName)
  //    const rootParticle = new Particle(`${parsersName}
  // ${ParsersConstants.root}`)

  //    // note: right now we assume 1 global cellTypeMap and parserMap per parsers. But we may have scopes in the future?
  //    const rootParticleNames = this.getFirstWords().map(word => HandParsersProgram.makeParserId(word))
  //    rootParticle
  //      .particleAt(0)
  //      .touchParticle(ParsersConstants.inScope)
  //      .setWordsFrom(1, Array.from(new Set(rootParticleNames)))

  //    return rootParticle
  //  }

  inferParsersFileForAKeywordLanguage(parsersName: string): string {
    const clone = <UnknownParsersProgram>this.clone()
    this._renameIntegerKeywords(clone)

    const { keywordsToChildKeywords, keywordsToParticleInstances } = this._getKeywordMaps(clone)

    const globalCellTypeMap = new Map()
    globalCellTypeMap.set(PreludeCellTypeIds.keywordCell, undefined)
    const parserDefs = Object.keys(keywordsToChildKeywords)
      .filter(identity => identity)
      .map(firstWord => this._inferParserDef(firstWord, globalCellTypeMap, Object.keys(keywordsToChildKeywords[firstWord]), keywordsToParticleInstances[firstWord]))

    const cellTypeDefs: string[] = []
    globalCellTypeMap.forEach((def, id) => cellTypeDefs.push(def ? def : id))
    const particleBreakSymbol = this.particleBreakSymbol

    return this._formatCode([this._inferRootParticleForAPrefixLanguage(parsersName).toString(), cellTypeDefs.join(particleBreakSymbol), parserDefs.join(particleBreakSymbol)].filter(identity => identity).join("\n"))
  }

  private _formatCode(code: string) {
    // todo: make this run in browser too
    if (!this.isNodeJs()) return code

    const parsersProgram = new HandParsersProgram(Particle.fromDisk(__dirname + "/../langs/parsers/parsers.parsers"))
    const rootParser = <any>parsersProgram.compileAndReturnRootParser()
    const program = new rootParser(code)
    return program.format().toString()
  }

  private _getBestCellType(firstWord: string, instanceCount: particlesTypes.int, maxCellsOnLine: particlesTypes.int, allValues: any[]): { cellTypeId: string; cellTypeDefinition?: string } {
    const asSet = new Set(allValues)
    const edgeSymbol = this.edgeSymbol
    const values = Array.from(asSet).filter(identity => identity)
    const every = (fn: Function) => {
      for (let index = 0; index < values.length; index++) {
        if (!fn(values[index])) return false
      }
      return true
    }
    if (every((str: string) => str === "0" || str === "1")) return { cellTypeId: PreludeCellTypeIds.bitCell }

    if (
      every((str: string) => {
        const num = parseInt(str)
        if (isNaN(num)) return false
        return num.toString() === str
      })
    ) {
      return { cellTypeId: PreludeCellTypeIds.intCell }
    }

    if (every((str: string) => str.match(/^-?\d*.?\d+$/))) return { cellTypeId: PreludeCellTypeIds.floatCell }

    const bools = new Set(["1", "0", "true", "false", "t", "f", "yes", "no"])
    if (every((str: string) => bools.has(str.toLowerCase()))) return { cellTypeId: PreludeCellTypeIds.boolCell }

    // todo: cleanup
    const enumLimit = 30
    if (instanceCount > 1 && maxCellsOnLine === 1 && allValues.length > asSet.size && asSet.size < enumLimit)
      return {
        cellTypeId: HandParsersProgram.makeCellTypeId(firstWord),
        cellTypeDefinition: `${HandParsersProgram.makeCellTypeId(firstWord)}
 enum ${values.join(edgeSymbol)}`
      }

    return { cellTypeId: PreludeCellTypeIds.anyCell }
  }
}

export { ParsersConstants, PreludeCellTypeIds, HandParsersProgram, ParserBackedParticle, UnknownParserError, UnknownParsersProgram }
