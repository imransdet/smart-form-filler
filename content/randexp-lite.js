(function (global) {
  const MAX_REPEAT = 10;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  class Parser {
    constructor(source) {
      this.src = source;
      this.pos = 0;
    }

    peek() {
      return this.src[this.pos];
    }

    next() {
      return this.src[this.pos++];
    }

    eof() {
      return this.pos >= this.src.length;
    }

    parseAlternation() {
      const branches = [this.parseConcat()];
      while (!this.eof() && this.peek() === "|") {
        this.next();
        branches.push(this.parseConcat());
      }
      return { type: "alt", branches };
    }

    parseConcat() {
      const parts = [];
      while (!this.eof() && this.peek() !== "|" && this.peek() !== ")") {
        parts.push(this.parseQuantified());
      }
      return { type: "concat", parts };
    }

    parseQuantified() {
      const atom = this.parseAtom();
      if (this.eof()) return atom;
      const c = this.peek();
      if (c === "*") {
        this.next();
        return { type: "repeat", min: 0, max: MAX_REPEAT, node: atom };
      }
      if (c === "+") {
        this.next();
        return { type: "repeat", min: 1, max: MAX_REPEAT, node: atom };
      }
      if (c === "?") {
        this.next();
        return { type: "repeat", min: 0, max: 1, node: atom };
      }
      if (c === "{") {
        const close = this.src.indexOf("}", this.pos);
        if (close !== -1) {
          const body = this.src.slice(this.pos + 1, close);
          const m = body.match(/^(\d+)(,(\d*))?$/);
          if (m) {
            this.pos = close + 1;
            const min = parseInt(m[1], 10);
            const max = m[2] ? (m[3] ? parseInt(m[3], 10) : MAX_REPEAT + min) : min;
            return { type: "repeat", min, max, node: atom };
          }
        }
      }
      return atom;
    }

    parseAtom() {
      const c = this.next();
      if (c === "(") {
        if (this.src.slice(this.pos, this.pos + 2) === "?:") this.pos += 2;
        const inner = this.parseAlternation();
        if (this.peek() === ")") this.next();
        return inner;
      }
      if (c === "[") {
        return this.parseCharClass();
      }
      if (c === "\\") {
        return this.parseEscape();
      }
      if (c === "." ) {
        return { type: "any" };
      }
      if (c === "^" || c === "$") {
        return { type: "concat", parts: [] };
      }
      return { type: "char", value: c };
    }

    parseEscape() {
      const c = this.next();
      const classes = {
        d: "0123456789",
        D: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        w: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_",
        W: " !@#$%^&*()-=+",
        s: " \t",
        S: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      };
      if (classes[c]) return { type: "set", chars: classes[c] };
      return { type: "char", value: c };
    }

    parseCharClass() {
      let negate = false;
      if (this.peek() === "^") {
        negate = true;
        this.next();
      }
      const ranges = [];
      while (!this.eof() && this.peek() !== "]") {
        let a = this.next();
        if (a === "\\") a = this.next();
        if (this.peek() === "-" && this.src[this.pos + 1] !== "]") {
          this.next();
          let b = this.next();
          if (b === "\\") b = this.next();
          ranges.push([a.charCodeAt(0), b.charCodeAt(0)]);
        } else {
          ranges.push([a.charCodeAt(0), a.charCodeAt(0)]);
        }
      }
      if (this.peek() === "]") this.next();
      if (!negate) return { type: "ranges", ranges };
      const allowed = [];
      for (let code = 32; code < 127; code++) {
        if (!ranges.some(([lo, hi]) => code >= lo && code <= hi)) allowed.push(code);
      }
      return { type: "set", chars: allowed.map((c) => String.fromCharCode(c)).join("") };
    }
  }

  function generate(node) {
    switch (node.type) {
      case "alt":
        return generate(pick(node.branches));
      case "concat":
        return node.parts.map(generate).join("");
      case "repeat": {
        const count = randInt(node.min, Math.max(node.min, node.max));
        let out = "";
        for (let i = 0; i < count; i++) out += generate(node.node);
        return out;
      }
      case "char":
        return node.value;
      case "any": {
        const printable = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        return pick(printable.split(""));
      }
      case "set":
        return pick(node.chars.split(""));
      case "ranges": {
        const [lo, hi] = pick(node.ranges);
        return String.fromCharCode(randInt(lo, hi));
      }
      default:
        return "";
    }
  }

  function randexp(pattern) {
    try {
      const cleaned = pattern.replace(/^\/|\/[a-z]*$/g, "");
      const parser = new Parser(cleaned);
      const ast = parser.parseAlternation();
      return generate(ast);
    } catch (e) {
      return "";
    }
  }

  global.FF = global.FF || {};
  global.FF.randexp = randexp;
})(typeof window !== "undefined" ? window : self);
