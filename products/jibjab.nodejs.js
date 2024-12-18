#! /usr/bin/env node
{
  const { Utils } = require("./Utils.js")
  const { Particle } = require("./Particle.js")
  const { HandParsersProgram } = require("./Parsers.js")
  const { ParserBackedParticle } = require("./Parsers.js")

  class jibberishParser extends ParserBackedParticle {
    createParserCombinator() {
      return new Particle.ParserCombinator(
        errorParser,
        Object.assign(Object.assign({}, super.createParserCombinator()._getCueMapAsObject()), {
          extendsAbstract: extendsAbstractParser,
          hue: hueParser,
          saturation: saturationParser,
          constrast: constrastParser,
          "html.h1": h1Parser,
          add: addParser,
          "+": plusParser,
          block: blockParser,
          scoreBlock: scoreBlockParser,
          to: toParser,
          foo: fooParser,
          xColumnName: xColumnNameParser,
          lightbulbState: lightbulbStateParser,
          nested: nestedParser,
          particleWithConsts: particleWithConstsParser,
          particleExpandsConsts: particleExpandsConstsParser,
          someCode: someCodeParser,
          type: typeParser,
          comment: commentParser,
          text: textParser
        }),
        undefined
      )
    }
    execute() {
      return 42
    }
  }

  class jibjabParser extends jibberishParser {
    static cachedHandParsersProgramRoot = new HandParsersProgram(`// Atom Parsers
anyAtom
columnNameEnumAtom
columnNameAtom
errorAtom
 paint invalid
integerAtom
 paint constant.numeric
onoffAtom
 enum on off
atomAtom
topLevelPropertyAtom
 paint constant.language
opSymbolAtom
 paint keyword.operator.arithmetic
commentAtom
 paint comment

// Line Parsers
jibberishParser
 root
 description A useless Language built for testing Particles code.
 javascript
  execute() {
   return 42
  }
 catchAllParser errorParser
 inScope abstractTopLevelParser textParser abstractBaseClassParser
jibjabParser jibberishParser
 root
 description Adds a comment particle to Jibberish
abstractBaseClassParser
extendsAbstractParser abstractBaseClassParser
 atoms topLevelPropertyAtom integerAtom
 cue extendsAbstract
abstractTopLevelParser
 atoms topLevelPropertyAtom
abstractColorPropertiesParser abstractTopLevelParser
 atoms topLevelPropertyAtom integerAtom
hueParser abstractColorPropertiesParser
 cue hue
saturationParser abstractColorPropertiesParser
 cue saturation
constrastParser abstractColorPropertiesParser
 cue constrast
abstractHtmlParser abstractTopLevelParser
 inScope contentParser
h1Parser abstractHtmlParser
 cue html.h1
addParser abstractTopLevelParser
 cue add
plusParser addParser
 cue +
 example Adding two numbers:
  + 1 2
 catchAllAtomType integerAtom
 atoms opSymbolAtom
blockParser abstractTopLevelParser
 inScope abstractTopLevelParser scoreBlockParser
 cue block
scoreBlockParser blockParser
 description Test that inscope extends and does not overwrite.
 inScope scoresParser
 cue scoreBlock
toParser blockParser
 atoms topLevelPropertyAtom atomAtom
 compiler
  stringTemplate to {atom}
  closeSubparticles end
 cue to
fooParser abstractTopLevelParser
 cue foo
xColumnNameParser abstractTopLevelParser
 description The name of the column to use for the x axis
 atoms topLevelPropertyAtom columnNameEnumAtom
 tags doNotSynthesize
 javascript
  getRunTimeEnumOptions(atom) {
   return atom.atomTypeId === "columnNameEnumAtom" ? ["gender", "height", "weight"] : undefined
  }
 cue xColumnName
lightbulbStateParser abstractTopLevelParser
 atoms topLevelPropertyAtom onoffAtom
 cue lightbulbState
nestedParser abstractTopLevelParser
 cue nested
particleWithConstsParser abstractTopLevelParser
 string greeting hello world
 string singleAtom hello
 string thisHasQuotes "'\`
 string longText
  hello
  world
 int score1 28
 int anArray 2 3 4
 float score2 3.01
 boolean win true
 cue particleWithConsts
particleExpandsConstsParser particleWithConstsParser
 string greeting hola
 cue particleExpandsConsts
someCodeParser abstractTopLevelParser
 catchAllParser lineOfCodeParser
 cue someCode
typeParser abstractTopLevelParser
 atoms topLevelPropertyAtom atomAtom
 single
 cue type
commentParser abstractTopLevelParser
 catchAllAtomType commentAtom
 catchAllParser commentParser
 cue comment
contentParser
 baseParser blobParser
 cue content
errorParser
 catchAllAtomType errorAtom
 baseParser errorParser
 atoms errorAtom
lineOfCodeParser
 catchAllAtomType atomAtom
textParser
 baseParser blobParser
 cue text
scoresParser
 catchAllAtomType integerAtom
 atoms topLevelPropertyAtom
 cue scores`)
    get handParsersProgram() {
      return this.constructor.cachedHandParsersProgramRoot
    }
    static rootParser = jibjabParser
  }

  class abstractBaseClassParser extends ParserBackedParticle {}

  class extendsAbstractParser extends abstractBaseClassParser {
    get topLevelPropertyAtom() {
      return this.getAtom(0)
    }
    get integerAtom() {
      return parseInt(this.getAtom(1))
    }
  }

  class abstractTopLevelParser extends ParserBackedParticle {
    get topLevelPropertyAtom() {
      return this.getAtom(0)
    }
  }

  class abstractColorPropertiesParser extends abstractTopLevelParser {
    get topLevelPropertyAtom() {
      return this.getAtom(0)
    }
    get integerAtom() {
      return parseInt(this.getAtom(1))
    }
  }

  class hueParser extends abstractColorPropertiesParser {}

  class saturationParser extends abstractColorPropertiesParser {}

  class constrastParser extends abstractColorPropertiesParser {}

  class abstractHtmlParser extends abstractTopLevelParser {
    createParserCombinator() {
      return new Particle.ParserCombinator(undefined, Object.assign(Object.assign({}, super.createParserCombinator()._getCueMapAsObject()), { content: contentParser }), undefined)
    }
  }

  class h1Parser extends abstractHtmlParser {}

  class addParser extends abstractTopLevelParser {}

  class plusParser extends addParser {
    get opSymbolAtom() {
      return this.getAtom(0)
    }
    get integerAtom() {
      return this.getAtomsFrom(1).map(val => parseInt(val))
    }
  }

  class blockParser extends abstractTopLevelParser {
    createParserCombinator() {
      return new Particle.ParserCombinator(
        undefined,
        Object.assign(Object.assign({}, super.createParserCombinator()._getCueMapAsObject()), {
          hue: hueParser,
          saturation: saturationParser,
          constrast: constrastParser,
          "html.h1": h1Parser,
          add: addParser,
          "+": plusParser,
          block: blockParser,
          scoreBlock: scoreBlockParser,
          to: toParser,
          foo: fooParser,
          xColumnName: xColumnNameParser,
          lightbulbState: lightbulbStateParser,
          nested: nestedParser,
          particleWithConsts: particleWithConstsParser,
          particleExpandsConsts: particleExpandsConstsParser,
          someCode: someCodeParser,
          type: typeParser,
          comment: commentParser
        }),
        undefined
      )
    }
  }

  class scoreBlockParser extends blockParser {
    createParserCombinator() {
      return new Particle.ParserCombinator(undefined, Object.assign(Object.assign({}, super.createParserCombinator()._getCueMapAsObject()), { scores: scoresParser }), undefined)
    }
  }

  class toParser extends blockParser {
    get topLevelPropertyAtom() {
      return this.getAtom(0)
    }
    get atomAtom() {
      return this.getAtom(1)
    }
  }

  class fooParser extends abstractTopLevelParser {}

  class xColumnNameParser extends abstractTopLevelParser {
    get topLevelPropertyAtom() {
      return this.getAtom(0)
    }
    get columnNameEnumAtom() {
      return this.getAtom(1)
    }
    getRunTimeEnumOptions(atom) {
      return atom.atomTypeId === "columnNameEnumAtom" ? ["gender", "height", "weight"] : undefined
    }
  }

  class lightbulbStateParser extends abstractTopLevelParser {
    get topLevelPropertyAtom() {
      return this.getAtom(0)
    }
    get onoffAtom() {
      return this.getAtom(1)
    }
  }

  class nestedParser extends abstractTopLevelParser {}

  class particleWithConstsParser extends abstractTopLevelParser {
    get win() {
      return true
    }
    get score2() {
      return 3.01
    }
    get anArray() {
      return [2, 3, 4]
    }
    get score1() {
      return 28
    }
    get longText() {
      return `hello
world`
    }
    get thisHasQuotes() {
      return `"'\``
    }
    get singleAtom() {
      return `hello`
    }
    get greeting() {
      return `hello world`
    }
  }

  class particleExpandsConstsParser extends particleWithConstsParser {
    get greeting() {
      return `hola`
    }
  }

  class someCodeParser extends abstractTopLevelParser {
    createParserCombinator() {
      return new Particle.ParserCombinator(lineOfCodeParser, undefined, undefined)
    }
  }

  class typeParser extends abstractTopLevelParser {
    get topLevelPropertyAtom() {
      return this.getAtom(0)
    }
    get atomAtom() {
      return this.getAtom(1)
    }
  }

  class commentParser extends abstractTopLevelParser {
    createParserCombinator() {
      return new Particle.ParserCombinator(commentParser, undefined, undefined)
    }
    get commentAtom() {
      return this.getAtomsFrom(0)
    }
  }

  class contentParser extends ParserBackedParticle {
    createParserCombinator() {
      return new Particle.ParserCombinator(this._getBlobParserCatchAllParser())
    }
    getErrors() {
      return []
    }
  }

  class errorParser extends ParserBackedParticle {
    getErrors() {
      return this._getErrorParserErrors()
    }
    get errorAtom() {
      return this.getAtom(0)
    }
    get errorAtom() {
      return this.getAtomsFrom(1)
    }
  }

  class lineOfCodeParser extends ParserBackedParticle {
    get atomAtom() {
      return this.getAtomsFrom(0)
    }
  }

  class textParser extends ParserBackedParticle {
    createParserCombinator() {
      return new Particle.ParserCombinator(this._getBlobParserCatchAllParser())
    }
    getErrors() {
      return []
    }
  }

  class scoresParser extends ParserBackedParticle {
    get topLevelPropertyAtom() {
      return this.getAtom(0)
    }
    get integerAtom() {
      return this.getAtomsFrom(1).map(val => parseInt(val))
    }
  }

  module.exports = jibjabParser
  jibjabParser

  if (!module.parent) new jibjabParser(Particle.fromDisk(process.argv[2]).toString()).execute()
}
