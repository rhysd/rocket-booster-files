/// <reference path="./typings/tsd.d.ts" />

// ES6 String API
interface String {
    startsWith(searchStr: string, pos?: number): boolean;
    includes(searchStr: string, pos?: number): boolean;
}
