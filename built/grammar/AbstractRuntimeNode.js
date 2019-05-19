"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TreeNode_1 = require("../base/TreeNode");
const GrammarConstants_1 = require("./GrammarConstants");
class AbstractRuntimeNode extends TreeNode_1.default {
    // note: this is overwritten by the root node of a runtime grammar program.
    // some of the magic that makes this all work. but maybe there's a better way.
    getGrammarProgram() {
        return this.getProgram().getGrammarProgram();
    }
    getCatchAllNodeConstructor(line) {
        return this.getDefinition().getRunTimeCatchAllNodeConstructor();
    }
    getProgram() {
        return this;
    }
    getAutocompleteResults(partialWord, cellIndex) {
        return cellIndex === 0
            ? this._getAutocompleteResultsForFirstWord(partialWord)
            : this._getAutocompleteResultsForCell(partialWord, cellIndex);
    }
    _getGrammarBackedCellArray() {
        return [];
    }
    getRunTimeEnumOptions(cell) {
        return undefined;
    }
    _getAutocompleteResultsForCell(partialWord, cellIndex) {
        // todo: root should be [] correct?
        const cell = this._getGrammarBackedCellArray()[cellIndex - 1];
        return cell ? cell.getAutoCompleteWords(partialWord) : [];
    }
    _getAutocompleteResultsForFirstWord(partialWord) {
        const def = this.getDefinition();
        let defs = Object.values(def.getRunTimeFirstWordMapWithDefinitions());
        if (partialWord)
            defs = defs.filter(def => def.getNodeTypeIdFromDefinition().includes(partialWord));
        return defs.map(def => {
            const id = def.getNodeTypeIdFromDefinition();
            const description = def.getDescription();
            return {
                text: id,
                displayText: id + (description ? " " + description : "")
            };
        });
    }
    _getNodeTypeDefinitionByName(path) {
        // todo: do we need a relative to with this firstWord path?
        return this.getProgram()
            .getGrammarProgram()
            .getNodeTypeDefinitionByFirstWordPath(path);
    }
    _getRequiredNodeErrors(errors = []) {
        const nodeDef = this.getDefinition();
        const firstWords = nodeDef.getRunTimeFirstWordMapWithDefinitions();
        Object.keys(firstWords).forEach(firstWord => {
            const def = firstWords[firstWord];
            if (def.isRequired() && !this.has(firstWord)) {
                errors.push({
                    kind: GrammarConstants_1.GrammarConstantsErrors.missingRequiredNodeTypeError,
                    subkind: firstWord,
                    level: 0,
                    context: "",
                    message: `${GrammarConstants_1.GrammarConstantsErrors.missingRequiredNodeTypeError} Required nodeType missing: "${firstWord}" in node '${this.getLine()}' at line '${this.getPoint().y}'`
                });
            }
        });
        return errors;
    }
}
exports.default = AbstractRuntimeNode;
