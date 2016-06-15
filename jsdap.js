/*
 * jsDAP 4.1.2, a JavaScript OPeNDAP client.
 *
 * You can find the uncompressed source at:
 *
 *   https://bitbucket.org/jetfuse/jsdap
 *
 * Copyright (c) 2007--2009 Roberto De Almeida
 */
var parser = {};

(function() {
    "use strict";
    var ATOMIC_TYPES = [ "byte", "int", "uint", "int16", "uint16", "int32", "uint32", "float32", "float64", "string", "url", "alias" ];
    var STRUCTURED_TYPES = [ "Sequence", "Structure", "Dataset" ];
    //Regular expressions
    //DDS parsing expressions
    var DDS_BASE_TYPE_DIMENSION_NAME_EXPRESSION = "(\\\\=|[^=])+";
    //Dimension name will end at the equals sign
    var DDS_BASE_TYPE_DIMENSION_VALUE_EXPRESSION = "\\d+";
    var DDS_BASE_TYPE_EXPRESSION = "\\w+";
    var DDS_BASE_TYPE_NAME_EXPRESSION = "(\\\\;|\\\\\\[|[^\\[;])+";
    //Type name ends with a square bracket or semicolon
    var DDS_DATASET_ID_EXPRESSION = "(\\\\;|[^;])+";
    //Ends with a semicolon
    var DDS_GRID_NAME_EXPRESSION = "(\\\\;|[^;])+";
    //Ends with a semicolon
    var DDS_SEQUENCE_NAME_EXPRESSION = "(\\\\;|[^;])+";
    //Ends with a semicolon
    var DDS_STRUCTURE_NAME_EXPRESSION = "(\\\\;|[^;])+";
    //Ends with a semicolon;
    //DAS parsing expressions
    var DAS_ALIAS_EXPRESSION = '".*?[^\\\\]"|[^;,]+';
    var DAS_ATTRIBUTE_TYPE_EXPRESSION = "\\w+";
    var DAS_ATTRIBUTE_NAME_EXPRESSION = "(\\\\\\s|[^\\s])+";
    //Ends with unescaped whitespace
    var DAS_CONTAINER_NAME_EXPRESSION = "(\\\\{|[^{])+";
    var DAS_METADATA_NAME_EXPRESSION = "(\\\\{|[^{])+";
    var DAS_NUMERICAL_EXPRESSION = '".*?[^\\\\]"|[^;,]+';
    var DAS_STRING_EXPRESSION = '"(\\\\"|[^"])*"';
    //Ends with a double quote
    var DAS_TYPE_EXPRESSION = "\\w+";
    var DAS_URL_EXPRESSION = '".*?[^\\\\]"|[^;,]+';
    Array.prototype.contains = function(item) {
        for (var i = 0, el = this[i]; i < this.length; el = this[++i]) {
            if (item === el) return true;
        }
        return false;
    };
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, "");
    };
    String.prototype.ltrim = function() {
        return this.replace(/^[\s\n\r\t]+/, "");
    };
    String.prototype.rtrim = function() {
        return this.replace(/\s+$/, "");
    };
    function pseudoSafeEval(str) {
        return eval("(" + str + ")");
    }
    //TODO: Should this be private?
    parser.dapType = function(type) {
        this.type = type;
        this.attributes = {};
    };
    function simpleParser(input) {
        this.stream = input;
        this.peek = function(expr) {
            var regExp = new RegExp("^" + expr, "i");
            var m = this.stream.match(regExp);
            if (m) {
                return m[0];
            } else {
                return "";
            }
        };
        this.consume = function(expr) {
            var regExp = new RegExp("^" + expr, "i");
            var m = this.stream.match(regExp);
            if (m) {
                this.stream = this.stream.substr(m[0].length).ltrim();
                return m[0];
            } else {
                throw new Error("Unable to parse stream: " + this.stream.substr(0, 10));
            }
        };
    }
    parser.ddsParser = function(dds) {
        this.stream = this.dds = dds;
        this._dataset = function() {
            var dataset = new parser.dapType("Dataset");
            this.consume("dataset");
            this.consume("{");
            while (!this.peek("}")) {
                var declaration = this._declaration();
                dataset[declaration.name] = declaration;
            }
            this.consume("}");
            dataset.name = this.consume(DDS_DATASET_ID_EXPRESSION).trim();
            this.consume(";");
            return dataset;
        };
        this.parse = this._dataset;
        this._declaration = function() {
            var type = this.peek(DDS_BASE_TYPE_EXPRESSION).toLowerCase();
            switch (type) {
              case "grid":
                return this._grid();

              case "structure":
                return this._structure();

              case "sequence":
                return this._sequence();

              default:
                return this._base_declaration();
            }
        };
        this._base_declaration = function() {
            var baseType = new parser.dapType();
            baseType.type = this.consume(DDS_BASE_TYPE_EXPRESSION).trim();
            baseType.name = this.consume(DDS_BASE_TYPE_NAME_EXPRESSION).trim();
            baseType.dimensions = [];
            baseType.shape = [];
            while (!this.peek(";")) {
                this.consume("\\[");
                var token = this.consume(DDS_BASE_TYPE_DIMENSION_NAME_EXPRESSION).trim();
                if (this.peek("=")) {
                    baseType.dimensions.push(token);
                    this.consume("=");
                    token = this.consume(DDS_BASE_TYPE_DIMENSION_VALUE_EXPRESSION).trim();
                }
                baseType.shape.push(parseInt(token));
                this.consume("\\]");
            }
            this.consume(";");
            return baseType;
        };
        this._grid = function() {
            var grid = new parser.dapType("Grid");
            this.consume("grid");
            this.consume("{");
            this.consume("array");
            this.consume(":");
            grid.array = this._base_declaration();
            this.consume("maps");
            this.consume(":");
            grid.maps = {};
            while (!this.peek("}")) {
                var map_ = this._base_declaration();
                grid.maps[map_.name] = map_;
            }
            this.consume("}");
            grid.name = this.consume(DDS_GRID_NAME_EXPRESSION).trim();
            this.consume(";");
            return grid;
        };
        this._sequence = function() {
            var sequence = new parser.dapType("Sequence");
            this.consume("sequence");
            this.consume("{");
            while (!this.peek("}")) {
                var declaration = this._declaration();
                sequence[declaration.name] = declaration;
            }
            this.consume("}");
            sequence.name = this.consume(DDS_SEQUENCE_NAME_EXPRESSION).trim();
            this.consume(";");
            return sequence;
        };
        this._structure = function() {
            var structure = new parser.dapType("Structure");
            this.consume("structure");
            this.consume("{");
            while (!this.peek("}")) {
                var declaration = this._declaration();
                structure[declaration.name] = declaration;
            }
            this.consume("}");
            structure.name = this.consume(DDS_STRUCTURE_NAME_EXPRESSION).trim();
            this.consume(";");
            return structure;
        };
    };
    parser.ddsParser.prototype = new simpleParser();
    parser.dasParser = function(das, dataset) {
        this.stream = this.das = das;
        this.dataset = dataset;
        this.parse = function() {
            this._target = this.dataset;
            this.consume("attributes");
            this.consume("{");
            while (!this.peek("}")) {
                this._attr_container();
            }
            this.consume("}");
            return this.dataset;
        };
        this._attr_container = function() {
            if (ATOMIC_TYPES.contains(this.peek(DAS_TYPE_EXPRESSION).toLowerCase())) {
                this._attribute(this._target.attributes);
                if (this._target.type === "Grid") {
                    for (map in this._target.maps) {
                        if (this.dataset[map]) {
                            var map = this._target.maps[map];
                            for (var name in map.attributes) {
                                this.dataset[map].attributes[name] = map.attributes[name];
                            }
                        }
                    }
                }
            } else {
                this._container();
            }
        };
        this._container = function() {
            var name = this.consume(DAS_CONTAINER_NAME_EXPRESSION).trim();
            this.consume("{");
            var target;
            if (name.indexOf(".") > -1) {
                var names = name.split(".");
                target = this._target;
                for (var i = 0; i < names.length; i++) {
                    this._target = this._target[names[i]];
                }
                while (!this.peek("}")) {
                    this._attr_container();
                }
                this.consume("}");
                this._target = target;
            } else if (STRUCTURED_TYPES.contains(this._target.type) && this._target[name]) {
                target = this._target;
                this._target = target[name];
                while (!this.peek("}")) {
                    this._attr_container();
                }
                this.consume("}");
                this._target = target;
            } else {
                this._target.attributes[name] = this._metadata();
                this.consume("}");
            }
        };
        this._metadata = function() {
            var output = {};
            while (!this.peek("}")) {
                if (ATOMIC_TYPES.contains(this.peek(DAS_TYPE_EXPRESSION).toLowerCase())) {
                    this._attribute(output);
                } else {
                    var name = this.consume(DAS_METADATA_NAME_EXPRESSION).trim();
                    this.consume("{");
                    output[name] = this._metadata();
                    this.consume("}");
                }
            }
            return output;
        };
        this._attribute = function(object) {
            var type = this.consume(DAS_ATTRIBUTE_TYPE_EXPRESSION).trim();
            var name = this.consume(DAS_ATTRIBUTE_NAME_EXPRESSION).trim();
            var value;
            var values = [];
            while (!this.peek(";")) {
                if (type.toLowerCase() === "string") {
                    value = this.consume(DAS_STRING_EXPRESSION).trim();
                } else if (type.toLowerCase() === "url") {
                    value = this.consume(DAS_URL_EXPRESSION).trim();
                } else if (type.toLowerCase() === "alias") {
                    var target, tokens;
                    value = this.consume(DAS_ALIAS_EXPRESSION).trim();
                    if (value.match(/^\\./)) {
                        tokens = value.substring(1).split(".");
                        target = this.dataset;
                    } else {
                        tokens = value.split(".");
                        target = this._target;
                    }
                    for (var i = 0; i < tokens.length; i++) {
                        var token = tokens[i];
                        if (target[token]) {
                            target = target[token];
                        } else if (target.array.name === token) {
                            target = target.array;
                        } else if (target.maps[token]) {
                            target = target.maps[token];
                        } else {
                            target = target.attributes[token];
                        }
                        value = target;
                    }
                } else {
                    value = this.consume(DAS_NUMERICAL_EXPRESSION).trim();
                    if (value.toLowerCase() === "nan") {
                        value = NaN;
                    } else {
                        value = pseudoSafeEval(value);
                    }
                }
                values.push(value);
                if (this.peek(",")) {
                    this.consume(",");
                }
            }
            this.consume(";");
            if (values.length === 1) {
                values = values[0];
            }
            object[name] = values;
        };
    };
    parser.dasParser.prototype = new simpleParser();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = parser;
    }
})();

var xdr = {};

(function() {
    "use strict";
    var END_OF_SEQUENCE = "¥\x00\x00\x00";
    var START_OF_SEQUENCE = "Z\x00\x00\x00";
    xdr.dapUnpacker = function(xdrdata, dapvar) {
        this._buf = xdrdata;
        this._view = new DataView(this._buf);
        //Get a view into the ArrayBuffer
        this.dapvar = dapvar;
        this._pos = 0;
        //Byte offset
        this.getValue = function() {
            var i = this._pos;
            var dapvar = this.dapvar;
            var type = dapvar.type.toLowerCase();
            var out = [];
            var tmp;
            var mark;
            if (type === "structure" || type === "dataset") {
                for (var child in dapvar) {
                    if (dapvar[child].type) {
                        this.dapvar = dapvar[child];
                        tmp = this.getValue();
                        out.push(tmp);
                    }
                }
                this.dapvar = dapvar;
                return out;
            } else if (type === "grid") {
                this.dapvar = dapvar.array;
                tmp = this.getValue();
                out.push(tmp);
                for (var map in dapvar.maps) {
                    if (dapvar.maps[map].type) {
                        this.dapvar = dapvar.maps[map];
                        tmp = this.getValue();
                        out.push(tmp);
                    }
                }
                this.dapvar = dapvar;
                return out;
            } else if (type === "sequence") {
                mark = this._unpack_uint32();
                dapvar = this.dapvar;
                while (mark !== 2768240640) {
                    var struct = [];
                    for (var child in dapvar) {
                        if (dapvar[child].type) {
                            this.dapvar = dapvar[child];
                            tmp = this.getValue();
                            struct.push(tmp);
                        }
                    }
                    out.push(struct);
                    mark = this._unpack_uint32();
                }
                this.dapvar = dapvar;
                return out;
            } else if (this._buf.slice(i, i + 4) === START_OF_SEQUENCE) {
                // This is a request for a base type variable inside a
                // sequence.
                mark = this._unpack_uint32();
                while (mark !== 2768240640) {
                    tmp = this.getValue();
                    out.push(tmp);
                    mark = this._unpack_uint32();
                }
                return out;
            } else {
                //Numeric or string type
                var n = 1;
                if (this.dapvar.shape.length) {
                    n = this._unpack_uint32();
                    if (type !== "url" && type !== "string") {
                        this._unpack_uint32();
                    }
                }
                if (type === "byte") {
                    out = this._unpack_bytes(n);
                } else if (type === "url" || type === "string") {
                    out = this._unpack_string(n);
                } else {
                    out = [];
                    var func;
                    switch (type) {
                      case "float32":
                        func = "_unpack_float32";
                        break;

                      case "float64":
                        func = "_unpack_float64";
                        break;

                      case "int":
                        func = "_unpack_int32";
                        break;

                      case "uint":
                        func = "_unpack_uint32";
                        break;

                        // NOTE: the two follwing items are not typos. UCAR THREDDS implementation of opendap seemingly does not
                        // work well with short datatypes in netcdf files. it gives the data type as [u]int16, but without any indication packs the values as 4 byte numbers.
                        // so we make a heuristic - if the buffer is long enough to contain 4 byte data
                        // assume it does. this can easily fail if there are multiple variables in the buffer
                        // that are of similar lengths, but it is what it is.
                      case "int16":
                        if ((this._view.byteLength - this._pos) >= (n * 4)) {
                            func = "_unpack_int32";
                        } else {
                            func = "_unpack_int16";
                        }
                        break;

                      case "uint16":
                        if ((this._view.byteLength - this._pos) >= (n * 4)) {
                            func = "_unpack_uint32";
                        } else {
                            func = "_unpack_uint16";
                        }
                        break;

                      case "int32":
                        func = "_unpack_int32";
                        break;

                      case "uint32":
                        func = "_unpack_uint32";
                        break;
                    }
                    for (var i = 0; i < n; i++) {
                        out.push(this[func]());
                    }
                }
            }
            if (this.dapvar.shape) {
                out = reshape(out, this.dapvar.shape);
            } else {
                out = out[0];
            }
            return out;
        };
        this._unpack_byte = function() {
            var startPos = this._pos;
            this._pos += 1;
            //Increment the byte counter
            return this._view.getUint8(startPos);
        };
        this._unpack_uint16 = function() {
            var startPos = this._pos;
            this._pos += 2;
            //Increment the byte counter
            return this._view.getUint16(startPos);
        };
        this._unpack_uint32 = function() {
            var startPos = this._pos;
            this._pos += 4;
            //Increment the byte counter
            return this._view.getUint32(startPos);
        };
        this._unpack_int16 = function() {
            var startPos = this._pos;
            this._pos += 2;
            //Increment the byte counter
            return this._view.getInt16(startPos);
        };
        this._unpack_int32 = function() {
            var startPos = this._pos;
            this._pos += 4;
            //Increment the byte counter
            return this._view.getInt32(startPos);
        };
        this._unpack_float32 = function() {
            var startPos = this._pos;
            this._pos += 4;
            //Increment the byte counter
            return this._view.getFloat32(startPos);
        };
        this._unpack_float64 = function() {
            var startPos = this._pos;
            this._pos += 8;
            //Increment the byte counter
            return this._view.getFloat64(startPos);
        };
        this._unpack_bytes = function(count) {
            var padding = (4 - count % 4) % 4;
            var bytes = [];
            for (var c = 0; c < count; c++) {
                bytes.push(this._unpack_byte());
            }
            this._pos += padding;
            return bytes;
        };
        this._unpack_string = function(count) {
            var strings = [];
            for (var c = 0; c < count; c++) {
                var n = this._unpack_uint32();
                //Length of the string
                var padding = (4 - n % 4) % 4;
                var str = "";
                for (var s = 0; s < n; s++) {
                    str += String.fromCharCode(this._unpack_byte());
                }
                strings.push(str);
                this._pos += padding;
            }
            return strings;
        };
    };
    var reshape = function(array, shape) {
        if (!shape.length) return array[0];
        var out = [];
        var size, start, stop;
        for (var i = 0; i < shape[0]; i++) {
            size = array.length / shape[0];
            start = i * size;
            stop = start + size;
            out.push(reshape(array.slice(start, stop), shape.slice(1)));
        }
        return out;
    };
    xdr.getBuffer = function(data) {
        //Converts data to an ArrayBuffer
        var arrayBuffer = new ArrayBuffer(data.length);
        var dataView = new DataView(arrayBuffer);
        for (var i = 0; i < data.length; i++) {
            dataView.setUint8(i, data.charCodeAt(i) & 255);
        }
        return arrayBuffer;
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = xdr;
    }
})();

var jsdap = {};

// if (typeof require !== "undefined" && module.exports) {
//     parser = require("./parser");
//     xdr = require("./xdr");
//     //Workaround infinite recursion when jsdap is included in a webpack project
//     if (typeof XMLHttpRequest === "undefined") {
//         XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
//     }
// }

(function() {
    "use strict";
    var XML_READY_STATE_DONE = 4;
    var proxyUrl = function(url, callback, binary) {
        var xml = new XMLHttpRequest();
        xml.open("GET", url, true);
        if (binary) {
            xml.responseType = "arraybuffer";
        } else {
            if (xml.overrideMimeType) {
                xml.overrideMimeType("text/plain; charset=x-user-defined");
            } else {
                xml.setRequestHeader("Accept-Charset", "x-user-defined");
            }
        }
        xml.onreadystatechange = function() {
            if (xml.readyState === XML_READY_STATE_DONE) {
                if (binary) {
                    var buf = xml.responseBody || xml.response || xml.mozResponseArrayBuffer;
                    //FF5
                    callback(buf);
                } else {
                    callback(xml.responseText);
                }
            }
        };
        xml.send("");
    };
    var dodsRequest = function(url, callback) {
        //Returns an object containing the DDS for the requested data, as well as the requested data
        proxyUrl(url, function(dods) {
            var dataStart = "\nData:\n";
            var view = new DataView(dods);
            var byteIndex = 0;
            var dds = "";
            //The DDS string
            while (byteIndex < view.byteLength) {
                dds += String.fromCharCode(view.getUint8(byteIndex));
                if (dds.indexOf(dataStart) !== -1) {
                    break;
                }
                byteIndex += 1;
            }
            dds = dds.substr(0, dds.length - dataStart.length);
            //Remove the start of data string '\nData:\n'
            dods = dods.slice(byteIndex + 1);
            //Split off the DDS data
            var dapvar = new parser.ddsParser(dds).parse();
            var data = new xdr.dapUnpacker(dods, dapvar).getValue();
            callback({
                dds: dapvar,
                data: data
            });
        }, true);
    };
    jsdap.loadDataset = function(url, callback, proxy) {
        //User proxy?
        if (proxy) url = proxy + "?url=" + encodeURIComponent(url);
        //Load DDS.
        proxyUrl(url + ".dds", function(dds) {
            var dataset = new parser.ddsParser(dds).parse();
            //Load DAS.
            proxyUrl(url + ".das", function(das) {
                dataset = new parser.dasParser(das, dataset).parse();
                callback(dataset);
            });
        });
    };
    jsdap.loadData = function(url, callback, proxy) {
        //User proxy?
        if (proxy) url = proxy + "?url=" + encodeURIComponent(url);
        dodsRequest(url, function(result) {
            callback(result.data);
        });
    };
    jsdap.loadDataAndDDS = function(url, callback, proxy) {
        //User proxy?
        if (proxy) url = proxy + "?url=" + encodeURIComponent(url);
        dodsRequest(url, function(result) {
            //Return the data and the DDS
            callback(result);
        });
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = jsdap;
    }
})();

//Define ArrayBuffer slice for IE10
if (!ArrayBuffer.prototype.slice) {
    ArrayBuffer.prototype.slice = function(begin, end) {
        if (begin === void 0) {
            begin = 0;
        }
        if (end === void 0) {
            end = this.byteLength;
        }
        begin = Math.floor(begin);
        end = Math.floor(end);
        if (begin < 0) {
            begin += this.byteLength;
        }
        if (end < 0) {
            end += this.byteLength;
        }
        begin = Math.min(Math.max(0, begin), this.byteLength);
        end = Math.min(Math.max(0, end), this.byteLength);
        if (end - begin <= 0) {
            return new ArrayBuffer(0);
        }
        var result = new ArrayBuffer(end - begin);
        var resultBytes = new Uint8Array(result);
        var sourceBytes = new Uint8Array(this, begin, end - begin);
        resultBytes.set(sourceBytes);
        return result;
    };
}
