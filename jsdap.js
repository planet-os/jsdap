!(function(){

// xdr
/////////////////////////

// Lots of code from http://jsfromhell.com/classes/binary-parser
//    Jonas Raoni Soares Silva
//    http://jsfromhell.com/classes/binary-parser [v1.0]

var END_OF_SEQUENCE = '\xa5\x00\x00\x00';
var START_OF_SEQUENCE = '\x5a\x00\x00\x00';

function dapUnpacker(xdrdata, dapvar){
    this._buf = xdrdata;
    this.dapvar = dapvar;

    this._pos = 0;

    this.getValue = function(){
        var i = this._pos;
        var type = this.dapvar.type.toLowerCase();

        if(type == 'structure' || type == 'dataset'){
            var out = [], tmp;
            dapvar = this.dapvar;
            for(var child in dapvar){
                if(dapvar[child] && dapvar[child].type){
                    this.dapvar = dapvar[child];
                    tmp = this.getValue();
                    out.push(tmp);
                }
            }
            this.dapvar = dapvar;
            return out;

        }else if(type == 'grid'){
            var out = [], tmp;
            dapvar = this.dapvar;

            this.dapvar = dapvar.array;
            tmp = this.getValue();
            out.push(tmp);

            for(map in dapvar.maps){
                this.dapvar = dapvar.maps[map];
                tmp = this.getValue();
                out.push(tmp);
            }

            this.dapvar = dapvar;
            return out;

        }else if(type == 'sequence'){
            var mark = this._unpack_uint32();
            var out = [], struct, tmp;
            dapvar = this.dapvar;
            while(mark != 2768240640){
                struct = [];
                for(child in dapvar){
                    if(dapvar[child].type){
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
            // This is a request for a base type variable inside a
            // sequence.
        }else if(this._buf.slice(i, i + 4) == START_OF_SEQUENCE){
            var mark = this._unpack_uint32();
            var out = [], tmp;
            while(mark != 2768240640){
                tmp = this.getValue();
                out.push(tmp);
                mark = this._unpack_uint32();
            }
            return out;
        }

        var n = 1;
        if(this.dapvar.shape.length){
            n = this._unpack_uint32();
            if(type != 'url' && type != 'string'){
                this._unpack_uint32();
            }
        }

        // Bytes?
        var out;
        if(type == 'byte'){
            out = this._unpack_bytes(n);
            // String?
        }else if(type == 'url' || type == 'string'){
            out = this._unpack_string(n);
        }else{
            out = [];
            var func;
            switch(type){
                case 'float32':
                    func = '_unpack_float32';
                    break;
                case 'float64':
                    func = '_unpack_float64';
                    break;
                case 'int'    :
                    func = '_unpack_int32';
                    break;
                case 'uint'   :
                    func = '_unpack_uint32';
                    break;
                case 'int16'  :
                    func = '_unpack_int16';
                    break;
                case 'uint16' :
                    func = '_unpack_uint16';
                    break;
                case 'int32'  :
                    func = '_unpack_int32';
                    break;
                case 'uint32' :
                    func = '_unpack_uint32';
                    break;
            }
            for(var i = 0; i < n; i++){
                out.push(this[func]());
            }
        }

        if(this.dapvar.shape){
            out = reshape(out, this.dapvar.shape);
        }else{
            out = out[0];
        }

        return out;
    };

    this._unpack_byte = function(){
        var bytes = 1;
        var signed = false;

        var i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    this._unpack_uint16 = function(){
        var bytes = 4;
        var signed = false;

        var i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    this._unpack_uint32 = function(){
        var bytes = 4;
        var signed = false;

        var i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    this._unpack_int16 = function(){
        var bytes = 4;
        var signed = true;

        var i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    this._unpack_int32 = function(){
        var bytes = 4;
        var signed = true;

        var i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeInt(data, bytes, signed);
    };

    this._unpack_float32 = function(){
        var precision = 23;
        var exponent = 8;
        var bytes = 4;

        var i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeFloat(data, precision, exponent);
    };

    this._unpack_float64 = function(){
        var precision = 52;
        var exponent = 11;
        var bytes = 8;

        var i = this._pos;
        this._pos = i + bytes;
        data = this._buf.slice(i, i + bytes);
        return decodeFloat(data, precision, exponent);
    };

    this._unpack_bytes = function(count){
        var i = this._pos;
        var out = [];
        for(var c = 0; c < count; c++){
            out.push(this._unpack_byte());
        }
        var padding = (4 - (count % 4)) % 4;
        this._pos = i + count + padding;

        return out;
    };

    this._unpack_string = function(count){
        var out = [];
        var n, i, j;
        for(var c = 0; c < count; c++){
            n = this._unpack_uint32();
            i = this._pos;
            data = this._buf.slice(i, i + n);

            padding = (4 - (n % 4)) % 4;
            this._pos = i + n + padding;

            // convert back to string
            var str = '';
            for(var i = 0; i < n; i++){
                str += String.fromCharCode(data[i]);
            }
            out.push(str);
        }

        return out;
    };
}

function reshape(array, shape){
    if(!shape.length){
        return array[0];
    }
    var out = [];
    var size, start, stop;
    for(var i = 0; i < shape[0]; i++){
        size = array.length / shape[0];
        start = i * size;
        stop = start + size;
        out.push(reshape(array.slice(start, stop), shape.slice(1)));
    }
    return out;
}

function shl(a, b){
    for(++b; --b; a = ((a %= 0x7fffffff + 1) & 0x40000000) == 0x40000000 ? a * 2 : (a - 0x40000000) * 2 + 0x7fffffff + 1){
        ;
    }
    return a;
}

function readBits(buffer, start, length){
    if(start < 0 || length <= 0){
        return 0;
    }

    for(var offsetLeft, offsetRight = start % 8, curByte = buffer.length - (start >> 3) - 1,
            lastByte = buffer.length + (-(start + length) >> 3), diff = curByte - lastByte,
            sum = ((buffer[curByte] >> offsetRight) & ((1 << (diff ? 8 - offsetRight : length)) - 1))
                + (diff && (offsetLeft = (start + length) % 8) ? (buffer[lastByte++] & ((1 << offsetLeft) - 1))
                << (diff-- << 3) - offsetRight : 0); diff; sum += shl(buffer[lastByte++], (diff-- << 3) - offsetRight)){
        ;
    }
    return sum;
}

function getBuffer(data){
    var b = new Array(data.length);
    for(var i = 0; i < data.length; i++){
        b[i] = data.charCodeAt(i) & 0xff;
    }
    return b;
}

function decodeInt(data, bytes, signed){
    var x = readBits(data, 0, bytes * 8);
    var max = Math.pow(2, bytes * 8);
    var integer;
    if(signed && x >= (max / 2)){
        integer = x - max;
    }else{
        integer = x;
    }
    return integer;
}

function decodeFloat(buffer, precisionBits, exponentBits){
    var buffer = data;

    var bias = Math.pow(2, exponentBits - 1) - 1;
    var signal = readBits(buffer, precisionBits + exponentBits, 1);
    var exponent = readBits(buffer, precisionBits, exponentBits);
    var significand = 0;
    var divisor = 2;
    var curByte = buffer.length + (-precisionBits >> 3) - 1;
    var byteValue, startBit, mask;

    do
    {
        for(byteValue = buffer[++curByte], startBit = precisionBits % 8 || 8, mask = 1 << startBit;
            mask >>= 1; (byteValue & mask) && (significand += 1 / divisor), divisor *= 2){
            ;
        }
    }while(precisionBits -= startBit);

    return exponent == (bias << 1) + 1 ? significand ? NaN : signal ? -Infinity : +Infinity
        : (1 + signal * -2) * (exponent || significand ? !exponent ? Math.pow(2, -bias + 1) * significand
        : Math.pow(2, exponent - bias) * (1 + significand) : 0);
}


// Parser
/////////////////////////
var atomicTypes = ['byte', 'int', 'uint', 'int16', 'uint16', 'int32', 'uint32', 'float32', 'float64', 'string', 'url', 'alias'];
var structures = ['Sequence', 'Structure', 'Dataset'];

var IDENTIFIER_REGEX = '[\\w-/]';

function contains(haystack, needle) {
    for (var i = 0, el = haystack[i]; i < haystack.length; el = haystack[++i]) {
        if (needle == el) return true;
    }
    return false;
}

function ltrim(str) {
    return str.replace(/^[\s\n\r\t]+/, '');
}


function pseudoSafeEval(str) {
    if (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/.test(str.
            replace(/\\./g, '@').
            replace(/"[^"\\\n\r]*"/g, ''))) {
        return eval('(' + str + ')');
    }
    return str;
}


function dapType(type) {
    this.type = type;
    this.attributes = {};
}


function simpleParser(input) {
    this.stream = input;

    this.peek = function(expr) {
        var regExp = new RegExp('^' + expr, 'i');
        m = this.stream.match(regExp);
        if (m) {
            return m[0];
        } else {
            return '';
        }
    };

    this.consume = function(expr) {
        var regExp = new RegExp('^' + expr, 'i');
        m = this.stream.match(regExp);
        if (m) {
            this.stream = ltrim(this.stream.substr(m[0].length));
            return m[0];
        } else {
            throw new Error("Unable to parse stream: " + this.stream.substr(0, 10));
        }
    };
}


function ddsParser(dds) {
    this.stream = this.dds = dds;

    this._dataset = function() {
        var dataset = new dapType('Dataset');

        this.consume('dataset');
        this.consume('{');
        while (!this.peek('}')) {
            var declaration = this._declaration();
            dataset[declaration.name] = declaration;
        }
        this.consume('}');

        dataset.id = dataset.name = this.consume('[^;]+');
        this.consume(';');

        // Set id.
        function walk(dapvar, includeParent) {
            for (attr in dapvar) {
                child = dapvar[attr];
                if (child.type) {
                    child.id = child.name;
                    if (includeParent) {
                        child.id = dapvar.id + '.' + child.id;
                    }
                    walk(child, true);
                }
            }
        }
        walk(dataset, false);

        return dataset;
    };
    this.parse = this._dataset;

    this._declaration = function() {
        var type = this.peek(IDENTIFIER_REGEX+'+').toLowerCase();
        switch (type) {
            case 'grid'     : return this._grid();
            case 'structure': return this._structure();
            case 'sequence' : return this._sequence();
            default         : return this._base_declaration();
        }
    };

    this._base_declaration = function() {
        var baseType = new dapType();

        baseType.type = this.consume(IDENTIFIER_REGEX+'+');
        baseType.name = this.consume(IDENTIFIER_REGEX+'+');

        baseType.dimensions = [];
        baseType.shape = [];
        while (!this.peek(';')) {
            this.consume('\\[');
            token = this.consume(IDENTIFIER_REGEX+'+');
            if (this.peek('=')) {
                baseType.dimensions.push(token);
                this.consume('=');
                token = this.consume('\\d+');
            }
            baseType.shape.push(parseInt(token));
            this.consume('\\]');
        }
        this.consume(';');

        return baseType;
    };

    this._grid = function() {
        var grid = new dapType('Grid');

        this.consume('grid');
        this.consume('{');

        this.consume('array');
        this.consume(':');
        grid.array = this._base_declaration();

        this.consume('maps');
        this.consume(':');
        grid.maps = {};
        while (!this.peek('}')) {
            var map_ = this._base_declaration();
            grid.maps[map_.name] = map_;
        }
        this.consume('}');

        grid.name = this.consume(IDENTIFIER_REGEX+'+');
        this.consume(';');

        return grid;
    };

    this._sequence = function() {
        var sequence = new dapType('Sequence');

        this.consume('sequence');
        this.consume('{');
        while (!this.peek('}')) {
            var declaration = this._declaration();
            sequence[declaration.name] = declaration;
        }
        this.consume('}');

        sequence.name = this.consume(IDENTIFIER_REGEX+'+');
        this.consume(';');

        return sequence;
    };

    this._structure = function() {
        var structure = new dapType('Structure');

        this.consume('structure');
        this.consume('{');
        while (!this.peek('}')) {
            var declaration = this._declaration();
            structure[declaration.name] = declaration;
        }
        this.consume('}');

        structure.name = this.consume(IDENTIFIER_REGEX+'+');

        structure.dimensions = [];
        structure.shape = [];
        while (!this.peek(';')) {
            this.consume('\\[');
            token = this.consume(IDENTIFIER_REGEX+'+');
            if (this.peek('=')) {
                structure.dimensions.push(token);
                this.consume('=');
                token = this.consume('\\d+');
            }
            structure.shape.push(parseInt(token));
            this.consume('\\]');
        }

        this.consume(';');

        return structure;
    };
}
ddsParser.prototype = new simpleParser;


function dasParser(das, dataset) {
    this.stream = this.das = das;
    this.dataset = dataset;

    this.parse = function() {
        this._target = this.dataset;

        this.consume('attributes');
        this.consume('{');
        while (!this.peek('}')) {
            this._attr_container();
        }
        this.consume('}');

        return this.dataset;
    };

    this._attr_container = function() {
        if (contains(atomicTypes, this.peek(IDENTIFIER_REGEX+'+').toLowerCase())) {
            this._attribute(this._target.attributes);

            if (this._target.type == 'Grid') {
                for (map in this._target.maps) {
                    if (this.dataset[map]) {
                        var map = this._target.maps[map];
                        for (name in map.attributes) {
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
        var name = this.consume('[\\w-_\\./]+');
        this.consume('{');

        if (name.indexOf('.') > -1) {
            var names = name.split('.');
            var target = this._target;
            for (var i=0; i<names.length; i++) {
                this._target = this._target[names[i]];
            }

            while (!this.peek('}')) {
                this._attr_container();
            }
            this.consume('}');

            this._target = target;
        } else if ((contains(structures, this._target.type)) && (this._target[name])) {
            var target = this._target;
            this._target = target[name];

            while (!this.peek('}')) {
                this._attr_container();
            }
            this.consume('}');

            this._target = target;
        } else {
            this._target.attributes[name] = this._metadata();
            this.consume('}');
        }
    };

    this._metadata = function() {
        var output = {};
        while (!this.peek('}')) {
            if (contains(atomicTypes, this.peek(IDENTIFIER_REGEX+'+').toLowerCase())) {
                this._attribute(output);
            } else {
                var name = this.consume(IDENTIFIER_REGEX+'+');
                this.consume('{');
                output[name] = this._metadata();
                this.consume('}');
            }
        }
        return output;
    };

    this._attribute = function(object) {
        var type = this.consume(IDENTIFIER_REGEX+'+');
        var name = this.consume(IDENTIFIER_REGEX+'+');

        var values = [];
        while (!this.peek(';')) {
            var value = this.consume('".*?[^\\\\]"|[^;,]+');

            if ((type.toLowerCase() == 'string') ||
                (type.toLowerCase() == 'url')) {
                value = pseudoSafeEval(value);
            } else if (type.toLowerCase() == 'alias') {
                var target, tokens;
                if (value.match(/^\\./)) {
                    tokens = value.substring(1).split('.');
                    target = this.dataset;
                } else {
                    tokens = value.split('.');
                    target = this._target;
                }

                for (var i=0; i<tokens.length; i++) {
                    var token = tokens[i];
                    if (target[token]) {
                        target = target[token];
                    } else if (target.array.name == token) {
                        target = target.array;
                    } else if (target.maps[token]) {
                        target = target.maps[token];
                    } else {
                        target = target.attributes[token];
                    }
                    value = target;
                }
            } else {
                if (value.toLowerCase() == 'nan') {
                    value = NaN;
                } else {
                    value = pseudoSafeEval(value);
                }
            }
            values.push(value);
            if (this.peek(',')) {
                this.consume(',');
            }
        }
        this.consume(';');

        if (values.length == 1) {
            values = values[0];
        }

        object[name] = values;
    };
}
dasParser.prototype = new simpleParser;

// jsdap
/////////////////////////

function proxyUrl(url, callback, binary, extraheaders) {
    if (window.XMLHttpRequest) {
        var xml = new XMLHttpRequest();
    }
    xml.open("GET", url, true);
    if (xml.overrideMimeType) {
        xml.overrideMimeType('text/plain; charset=x-user-defined');
    } else {
        xml.setRequestHeader('Accept-Charset', 'x-user-defined');
    }
    if(extraheaders) {
        for(var key in extraheaders) {
            xml.setRequestHeader(key,extraheaders[key]);
        }
    }

    xml.onreadystatechange = function() {
        if (xml.readyState == 4) {
            if (!binary) {
                callback(xml.responseText);
            } else {
                callback(getBuffer(xml.responseText));
            }
        }
    };
    xml.send('');
}

/**
 * Load the dataset and call the callback with (dataset) where dataset is the dataset "metadata";
 * - url (string): the url (must be a bare OPeNDAP url, without "format extension" nor query parameters).
 * - callback (function(data)): the callback which will receive parsed data.
 * - extraheaders (map/object) : Javascript Object or map that contains keys and values of additonnal headers for the request.
 */
function loadDataset(url, callback, extraheaders) {

    // Load DDS.
    proxyUrl(url + '.dds', function(dds) {
        var dataset = new ddsParser(dds).parse();

        // Load DAS.
        proxyUrl(url + '.das', function(das) {
            dataset = new dasParser(das, dataset).parse();
            callback(dataset);
        },false,extraheaders);
    },false,extraheaders);
}

/** Flatten the data array as data attributes of elements of dapvar */
function _applydata(data,dapvar) {
    var i = 0;
    for(var child in dapvar) {
        if(!dapvar[child] || !dapvar[child].type) continue;
        dapvar[child].data=data[i++];
        if(dapvar[child].type == 'Structure') {
            _applydata(dapvar[child].data,dapvar[child]);
        }
    }

}
/**
 * Load the dataset and call the callback with (data) where data is an array of data
 * the url must be a url with .dods extension.
 * @params:
 * - url (string): the url (must be a .dods url, it might have additonnal slicing OpENDAP query string)
 * - callback (function(data)): the callback which will receive parsed data.
 * - extraheaders (map/object) : Javascript Object or map that contains keys and values of additonnal headers for the request.
 */
function loadData(url, callback, extraheaders) {

    proxyUrl(url, function(dods) {
        var dds = '';
        while (!dds.match(/\nData:\n$/)) {
            var c = dods.splice(0, 1);
            if(c.length === 0) throw new Error("Error reading data, are you sur this is a .dods request ?");
            dds += String.fromCharCode(c);
        }
        dds = dds.substr(0, dds.length-7);

        var dapvar = new ddsParser(dds).parse();
        var data = new dapUnpacker(dods, dapvar).getValue();
        _applydata(data,dapvar);
        callback(dapvar);
    }, true, extraheaders);
}
    var exports = {
        loadData: loadData,
        loadDataset: loadDataset
    };

    if (typeof module === "object" && module.exports) module.exports = exports;
    this.jsdap = exports;

})();