export declare namespace types {
    interface ParseError {
        kind: string;
        subkind: string;
        level: int;
        context: string;
        message: string;
    }
    interface point {
        x: int;
        y: int;
    }
    type treeNode = any;
    type something = string | Object | any | treeNode;
    type line = string;
    type int = number;
    type positiveInt = number;
    type stringMap = {
        [keyword: string]: any;
    };
    type htmlString = string;
    type xmlString = string;
    type jsonString = string;
    type dataTable = (any[])[];
    type formatString = string;
    type keywordPath = string;
    type pathVector = int[];
    type word = string;
    type triInt = int;
    type filepath = string;
    type highlightScope = string;
    type fileExtension = string;
    type sortFn = (nodeA: treeNode, nodeB: treeNode) => triInt;
    type filterFn = (node: treeNode, index: int) => boolean;
    type forEachFn = (node: treeNode, index: int) => void;
    type TreeNodeConstructor = Function;
    type RunTimeNodeConstructor = Function;
    type TreeProgramConstructor = Function;
    type treeProgram = treeNode;
    type keywordToNodeMap = {
        [keyword: string]: TreeNodeConstructor;
    };
}
export default types;
