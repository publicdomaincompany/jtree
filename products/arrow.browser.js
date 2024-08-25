{
  class commentParser extends ParserBackedNode {
    get commentCell() {
      return this.getWord(0)
    }
    get commentCell() {
      return this.getWordsFrom(1)
    }
    get suggestInAutocomplete() {
      return false
    }
  }

  class arrowParser extends ParserBackedNode {
    createParserCombinator() {
      return new TreeNode.ParserCombinator(errorParser, Object.assign(Object.assign({}, super.createParserCombinator()._getFirstWordMapAsObject()), { Comment: commentParser, charge: chargeParser }), undefined)
    }
    compile() {
      return this.asJsonSubset
    }
    static cachedHandParsersProgramRoot = new HandParsersProgram(`// Cell parsers
keywordCell
 enum charge cardNumber amount currency description token
floatCell
intCell
anyCell
cardNumberCell
 description The credit card number
 paint constant.numeric
 examples 1111222233334444
amountCell
 description Amount to be charged in the specified currency.
 extends floatCell
 examples 9.99
 min 0
 max 99999
descriptionCell
 description Any text can go in the charge description.
 paint string
 extends anyCell
 examples IceCream
tokenCell
 description A random token code generated by the hypothetical Arrow Company.
 paint string
 examples sk_test_4eC39H
currencyCell
 enum usd cad jpy
 paint constant.numeric
commentCell
 paint comment

// Line parsers
commentParser
 catchAllCellType commentCell
 cells commentCell
 crux Comment
 boolean suggestInAutocomplete false
arrowParser
 description A demonstration prefix Language showing how in the future Scroll Notation will be used for simpler and more intelligent APIs.
 root
 inScope chargeParser commentParser
 catchAllParser errorParser
 javascript
  compile() {
   return this.asJsonSubset
  }
errorParser
 baseParser errorParser
chargeParser
 inScope amountParser currencyParser descriptionParser cardNumberParser tokenParser
 description A credit card charge
 cruxFromId
 cells keywordCell
 javascript
  async execute() {
   const card = this.get("cardNumber")
   return \`Successfully charged \${this.get("amount")} \${this.get("currency")} to card \${card.substr(card.length - 4, 4)}.\`
  }
abstractChargeAttributeParser
 cruxFromId
 required
 single
cardNumberParser
 extends abstractChargeAttributeParser
 cells keywordCell cardNumberCell
amountParser
 extends abstractChargeAttributeParser
 cells keywordCell amountCell
currencyParser
 extends abstractChargeAttributeParser
 cells keywordCell currencyCell
descriptionParser
 extends abstractChargeAttributeParser
 cells keywordCell
 catchAllCellType descriptionCell
tokenParser
 cruxFromId
 cells keywordCell tokenCell`)
    get handParsersProgram() {
      return this.constructor.cachedHandParsersProgramRoot
    }
    static rootParser = arrowParser
  }

  class errorParser extends ParserBackedNode {
    getErrors() {
      return this._getErrorParserErrors()
    }
  }

  class chargeParser extends ParserBackedNode {
    createParserCombinator() {
      return new TreeNode.ParserCombinator(
        undefined,
        Object.assign(Object.assign({}, super.createParserCombinator()._getFirstWordMapAsObject()), { cardNumber: cardNumberParser, amount: amountParser, currency: currencyParser, description: descriptionParser, token: tokenParser }),
        undefined
      )
    }
    get keywordCell() {
      return this.getWord(0)
    }
    async execute() {
      const card = this.get("cardNumber")
      return `Successfully charged ${this.get("amount")} ${this.get("currency")} to card ${card.substr(card.length - 4, 4)}.`
    }
  }

  class abstractChargeAttributeParser extends ParserBackedNode {}

  class cardNumberParser extends abstractChargeAttributeParser {
    get keywordCell() {
      return this.getWord(0)
    }
    get cardNumberCell() {
      return this.getWord(1)
    }
  }

  class amountParser extends abstractChargeAttributeParser {
    get keywordCell() {
      return this.getWord(0)
    }
    get amountCell() {
      return parseFloat(this.getWord(1))
    }
  }

  class currencyParser extends abstractChargeAttributeParser {
    get keywordCell() {
      return this.getWord(0)
    }
    get currencyCell() {
      return this.getWord(1)
    }
  }

  class descriptionParser extends abstractChargeAttributeParser {
    get keywordCell() {
      return this.getWord(0)
    }
    get descriptionCell() {
      return this.getWordsFrom(1)
    }
  }

  class tokenParser extends ParserBackedNode {
    get keywordCell() {
      return this.getWord(0)
    }
    get tokenCell() {
      return this.getWord(1)
    }
  }

  window.arrowParser = arrowParser
}
