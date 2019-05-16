"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TreeUtils_1 = require("../base/TreeUtils");
const GrammarConstants_1 = require("./GrammarConstants");
const AbstractRuntimeNode_1 = require("./AbstractRuntimeNode");
const GrammarBackedCell_1 = require("./GrammarBackedCell");
class AbstractRuntimeNonRootNode extends AbstractRuntimeNode_1.default {
    getProgram() {
        return this.getParent().getProgram();
    }
    getGrammarProgram() {
        return this.getDefinition().getProgram();
    }
    getDefinition() {
        // todo: do we need a relative to with this keyword path?
        return this._getKeywordDefinitionByName(this.getKeywordPath());
    }
    getCompilerNode(targetLanguage) {
        return this.getDefinition().getDefinitionCompilerNode(targetLanguage, this);
    }
    getParsedWords() {
        return this._getGrammarBackedCellArray().map(word => word.getParsed());
    }
    getCompiledIndentation(targetLanguage) {
        const compiler = this.getCompilerNode(targetLanguage);
        const indentCharacter = compiler.getIndentCharacter();
        const indent = this.getIndentation();
        return indentCharacter !== undefined ? indentCharacter.repeat(indent.length) : indent;
    }
    getCompiledLine(targetLanguage) {
        const compiler = this.getCompilerNode(targetLanguage);
        const listDelimiter = compiler.getListDelimiter();
        const str = compiler.getTransformation();
        return str ? TreeUtils_1.default.formatStr(str, listDelimiter, this.cells) : this.getLine();
    }
    compile(targetLanguage) {
        return this.getCompiledIndentation(targetLanguage) + this.getCompiledLine(targetLanguage);
    }
    getErrors() {
        // Not enough parameters
        // Too many parameters
        // Incorrect parameter
        const errors = this._getGrammarBackedCellArray()
            .map(check => check.getErrorIfAny())
            .filter(i => i);
        // More than one
        const definition = this.getDefinition();
        let times;
        const keyword = this.getKeyword();
        if (definition.isSingle() && (times = this.getParent().findNodes(keyword).length) > 1)
            errors.push({
                kind: GrammarConstants_1.GrammarConstantsErrors.keywordUsedMultipleTimesError,
                subkind: keyword,
                level: 0,
                context: this.getParent().getLine(),
                message: `${GrammarConstants_1.GrammarConstantsErrors.keywordUsedMultipleTimesError} keyword "${keyword}" used '${times}' times. '${this.getLine()}' at line '${this.getPoint().y}'`
            });
        return this._getRequiredNodeErrors(errors);
    }
    get cells() {
        const cells = {};
        this._getGrammarBackedCellArray().forEach(cell => {
            if (!cell.isCatchAll())
                cells[cell.getCellTypeName()] = cell.getParsed();
            else {
                if (!cells[cell.getCellTypeName()])
                    cells[cell.getCellTypeName()] = [];
                cells[cell.getCellTypeName()].push(cell.getParsed());
            }
        });
        return cells;
    }
    _getGrammarBackedCellArray() {
        const definition = this.getDefinition();
        const grammarProgram = definition.getProgram();
        const cellTypes = definition.getRequiredCellTypeNames(); // todo: are these nodeRequiredColumnTypes? ... also, rename to cell instead of column?
        const numberOfRequiredCells = cellTypes.length;
        const expectedLinePattern = cellTypes.join(" ");
        const catchAllCellType = definition.getCatchAllCellTypeName();
        const words = this.getWordsFrom(1);
        const numberOfCellsToFill = Math.max(words.length, numberOfRequiredCells);
        const cells = [];
        // A for loop instead of map because "numberOfCellsToFill" can be longer than words.length
        for (let cellIndex = 0; cellIndex < numberOfCellsToFill; cellIndex++) {
            const isCatchAll = cellIndex >= numberOfRequiredCells;
            const cellTypeName = isCatchAll ? catchAllCellType : cellTypes[cellIndex];
            const cellTypeDefinition = grammarProgram.getCellTypeDefinition(cellTypeName);
            // todo: no guarantee that we will have 'cellTypeDefinition'. i could type 'bint' instead of 'int'
            const cellConstructor = cellTypeDefinition
                ? cellTypeDefinition.getCellConstructor()
                : cellTypeName
                    ? GrammarBackedCell_1.GrammarUnknownCellTypeCell
                    : GrammarBackedCell_1.GrammarExtraWordCellTypeCell;
            cells[cellIndex] = new cellConstructor(words[cellIndex], cellTypeDefinition, this, cellIndex, isCatchAll, expectedLinePattern, grammarProgram, this.getProgram());
        }
        return cells;
    }
    // todo: just make a fn that computes proper spacing and then is given a node to print
    getLineSyntax() {
        const parameterWords = this._getGrammarBackedCellArray().map(slot => slot.getCellTypeName());
        return ["keyword"].concat(parameterWords).join(" ");
    }
    getLineHighlightScopes(defaultScope = "source") {
        const wordScopes = this._getGrammarBackedCellArray().map(slot => slot.getHighlightScope() || defaultScope);
        return [this.getDefinition().getHighlightScope() || defaultScope].concat(wordScopes).join(" ");
    }
}
exports.default = AbstractRuntimeNonRootNode;