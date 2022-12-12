{
  class arrowNode extends jtree.GrammarBackedNode {
    createParser() {
      return new jtree.TreeNode.Parser(
        errorNode,
        Object.assign(Object.assign({}, super.createParser()._getFirstWordMapAsObject()), { charge: chargeNode }),
        undefined
      )
    }
    compile() {
      return this.toJsonSubset()
    }
    static cachedHandGrammarProgramRoot = new jtree.HandGrammarProgram(`keywordCell
 enum charge cardNumber amount currency description token
floatCell
intCell
anyCell
cardNumberCell
 description The credit card number
 highlightScope constant.numeric
 examples 1111222233334444
amountCell
 description Amount to be charged in the specified currency.
 extends floatCell
 examples 9.99
 min 0
 max 99999
descriptionCell
 description Any text can go in the charge description.
 highlightScope string
 extends anyCell
 examples IceCream
tokenCell
 description A random token code generated by the hypothetical Arrow Company.
 highlightScope string
 examples sk_test_4eC39H
currencyCell
 enum usd cad jpy
 highlightScope constant.numeric
arrowNode
 description A demonstration prefix Tree Language showing how in the future Tree Notation will be used for simpler and more intelligent APIs.
 root
 inScope chargeNode
 catchAllNodeType errorNode
 javascript
  compile() {
   return this.toJsonSubset()
  }
errorNode
 baseNodeType errorNode
chargeNode
 inScope amountNode currencyNode descriptionNode cardNumberNode tokenNode
 description A credit card charge
 cruxFromId
 cells keywordCell
 javascript
  async execute() {
   const card = this.get("cardNumber")
   return \`Successfully charged \${this.get("amount")} \${this.get("currency")} to card \${card.substr(card.length - 4, 4)}.\`
  }
abstractChargeAttributeNode
 cruxFromId
 required
 single
cardNumberNode
 extends abstractChargeAttributeNode
 cells keywordCell cardNumberCell
amountNode
 extends abstractChargeAttributeNode
 cells keywordCell amountCell
currencyNode
 extends abstractChargeAttributeNode
 cells keywordCell currencyCell
descriptionNode
 extends abstractChargeAttributeNode
 cells keywordCell
 catchAllCellType descriptionCell
tokenNode
 cruxFromId
 cells keywordCell tokenCell`)
    getHandGrammarProgram() {
      return this.constructor.cachedHandGrammarProgramRoot
    }
    static getNodeTypeMap() {
      return {
        arrowNode: arrowNode,
        errorNode: errorNode,
        chargeNode: chargeNode,
        abstractChargeAttributeNode: abstractChargeAttributeNode,
        cardNumberNode: cardNumberNode,
        amountNode: amountNode,
        currencyNode: currencyNode,
        descriptionNode: descriptionNode,
        tokenNode: tokenNode
      }
    }
  }

  class errorNode extends jtree.GrammarBackedNode {
    getErrors() {
      return this._getErrorNodeErrors()
    }
  }

  class chargeNode extends jtree.GrammarBackedNode {
    createParser() {
      return new jtree.TreeNode.Parser(
        undefined,
        Object.assign(Object.assign({}, super.createParser()._getFirstWordMapAsObject()), {
          cardNumber: cardNumberNode,
          amount: amountNode,
          currency: currencyNode,
          description: descriptionNode,
          token: tokenNode
        }),
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

  class abstractChargeAttributeNode extends jtree.GrammarBackedNode {}

  class cardNumberNode extends abstractChargeAttributeNode {
    get keywordCell() {
      return this.getWord(0)
    }
    get cardNumberCell() {
      return this.getWord(1)
    }
  }

  class amountNode extends abstractChargeAttributeNode {
    get keywordCell() {
      return this.getWord(0)
    }
    get amountCell() {
      return parseFloat(this.getWord(1))
    }
  }

  class currencyNode extends abstractChargeAttributeNode {
    get keywordCell() {
      return this.getWord(0)
    }
    get currencyCell() {
      return this.getWord(1)
    }
  }

  class descriptionNode extends abstractChargeAttributeNode {
    get keywordCell() {
      return this.getWord(0)
    }
    get descriptionCell() {
      return this.getWordsFrom(1)
    }
  }

  class tokenNode extends jtree.GrammarBackedNode {
    get keywordCell() {
      return this.getWord(0)
    }
    get tokenCell() {
      return this.getWord(1)
    }
  }

  window.arrowNode = arrowNode
}