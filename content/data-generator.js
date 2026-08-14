(function (global) {
  const FIRST_NAMES = [
    "Olivia", "Charlotte", "Amelia", "Isla", "Mia", "Grace", "Ava", "Willow",
    "Chloe", "Sophie", "Jack", "William", "Noah", "Oliver", "Lucas", "Henry",
    "Thomas", "James", "Ethan", "Leo", "Priya", "Wei", "Hana", "Mateo", "Aroha",
  ];
  const LAST_NAMES = [
    "Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Nguyen", "Kelly",
    "Ryan", "Walker", "Chen", "Singh", "Anderson", "Thompson", "White", "Lee",
    "Martin", "Harris", "Clarke", "Robinson",
  ];
  const ORG_NAMES = [
    "Southern Cross", "Harbourview", "Outback", "Coastal", "Summit", "Blue Gum",
    "Redgum", "Northbridge", "Wattle", "Ironbark",
  ];
  const ORG_SUFFIXES = ["Pty Ltd", "Group", "Holdings", "Solutions", "Partners", "Co."];
  const STREET_NAMES = [
    "High St", "George St", "Church St", "Station Rd", "Park Ave", "King St",
    "Queen St", "Victoria Rd", "Bridge St", "Main Rd",
  ];
  const AU_CITIES = [
    { city: "Sydney", state: "NSW", postcode: "2000" },
    { city: "Melbourne", state: "VIC", postcode: "3000" },
    { city: "Brisbane", state: "QLD", postcode: "4000" },
    { city: "Perth", state: "WA", postcode: "6000" },
    { city: "Adelaide", state: "SA", postcode: "5000" },
    { city: "Hobart", state: "TAS", postcode: "7000" },
    { city: "Canberra", state: "ACT", postcode: "2600" },
    { city: "Darwin", state: "NT", postcode: "0800" },
  ];
  const COUNTRIES = ["Australia", "New Zealand", "United Kingdom", "United States", "Canada", "Singapore"];
  const EMAIL_DOMAINS = ["example.com", "mailinator.com", "test.com.au", "sample.org"];
  const LOREM_WORDS = (
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod " +
    "tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam"
  ).split(" ");

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function pad(n, len) {
    return String(n).padStart(len, "0");
  }

  function firstName() {
    return pick(FIRST_NAMES);
  }

  function lastName() {
    return pick(LAST_NAMES);
  }

  function fullName() {
    return `${firstName()} ${lastName()}`;
  }

  function username() {
    return `${firstName().toLowerCase()}.${lastName().toLowerCase()}${randInt(1, 999)}`;
  }

  function password() {
    const symbols = "!@#$%";
    return `${pick(["Aa", "Bb", "Cc"])}${randInt(10000, 99999)}${pick(symbols.split(""))}`;
  }

  function createIdentity() {
    const cache = {};
    return {
      get(key, factory) {
        if (!(key in cache)) cache[key] = factory();
        return cache[key];
      },
    };
  }

  function generateEmail(opts, identity) {
    const usernameSource = opts.usernameSource || "random";
    let uname;
    switch (usernameSource) {
      case "previousUsername":
        uname = identity ? identity.get("username", username) : username();
        break;
      case "previousName": {
        const f = identity ? identity.get("firstName", firstName) : firstName();
        const l = identity ? identity.get("lastName", lastName) : lastName();
        uname = `${f}.${l}`;
        break;
      }
      case "list":
        uname = fromList(opts.usernameList) || username();
        break;
      case "regex":
        uname = (global.FF && global.FF.randexp && global.FF.randexp(opts.usernameRegex || "")) || username();
        break;
      case "random":
      default:
        uname = username();
    }
    let host = "";
    if (opts.hostnameSource === "list" && (opts.hostnameList || []).length) {
      host = fromList(opts.hostnameList).replace(/^@/, "");
    }
    if (!host) host = pick(EMAIL_DOMAINS);
    const prefix = opts.usernamePrefix || "";
    return `${prefix}${uname}@${host}`.toLowerCase().replace(/\s+/g, "");
  }

  function telephone(template) {
    // Australian mobile by default: 04## ### ###
    return applyTemplate(template || "04## ### ###");
  }

  function applyTemplate(template) {
    let out = "";
    for (const ch of template) {
      if (ch === "#") out += String(randInt(0, 9));
      else if (ch === "?") out += pick("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
      else if (ch === "@") out += pick("abcdefghijklmnopqrstuvwxyz".split(""));
      else if (ch === "*") out += pick("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""));
      else out += ch;
    }
    return out;
  }

  function address() {
    return `${randInt(1, 400)} ${pick(STREET_NAMES)}`;
  }

  function cityStatePostcode() {
    return pick(AU_CITIES);
  }

  function city() {
    return cityStatePostcode().city;
  }

  function state() {
    return cityStatePostcode().state;
  }

  function zip() {
    return cityStatePostcode().postcode;
  }

  function country() {
    return pick(COUNTRIES);
  }

  function organization() {
    return `${pick(ORG_NAMES)} ${pick(ORG_SUFFIXES)}`;
  }

  function url() {
    return `https://www.${pick(ORG_NAMES).toLowerCase().replace(/\s+/g, "")}.com.au`;
  }

  function color() {
    return `#${randInt(0, 0xffffff).toString(16).padStart(6, "0")}`;
  }

  function text(minWords, maxWords) {
    const count = randInt(minWords || 4, maxWords || 12);
    const words = [];
    for (let i = 0; i < count; i++) words.push(pick(LOREM_WORDS));
    const sentence = words.join(" ");
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
  }

  function number(min, max, decimals) {
    const lo = typeof min === "number" && !Number.isNaN(min) ? min : 0;
    const hi = typeof max === "number" && !Number.isNaN(max) ? max : lo + 1000;
    if (decimals && decimals > 0) {
      const value = Math.random() * (hi - lo) + lo;
      return value.toFixed(decimals);
    }
    return String(randInt(Math.ceil(lo), Math.floor(hi)));
  }

  function dateValue(kind, minDays, maxDays) {
    const lo = typeof minDays === "number" ? minDays : -3650;
    const hi = typeof maxDays === "number" ? maxDays : 3650;
    const offset = randInt(Math.min(lo, hi), Math.max(lo, hi));
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1, 2);
    const day = pad(d.getDate(), 2);
    const hh = pad(randInt(0, 23), 2);
    const mm = pad(randInt(0, 59), 2);
    switch (kind) {
      case "month":
        return `${y}-${m}`;
      case "week": {
        const firstJan = new Date(y, 0, 1);
        const week = Math.ceil(((d - firstJan) / 86400000 + firstJan.getDay() + 1) / 7);
        return `${y}-W${pad(week, 2)}`;
      }
      case "time":
        return `${hh}:${mm}`;
      case "datetime-local":
        return `${y}-${m}-${day}T${hh}:${mm}`;
      case "date":
      default:
        return `${y}-${m}-${day}`;
    }
  }

  function fromList(values) {
    const arr = (values || []).filter((v) => v !== "");
    if (!arr.length) return "";
    return pick(arr);
  }

  function generate(dataType, options, kind, identity) {
    const opts = options || {};
    switch (dataType) {
      case "static":
        return opts.value || "";
      case "text":
        return text(opts.minWords, opts.maxWords);
      case "alphanumeric":
        return applyTemplate(opts.template || "AAA-####");
      case "number":
        return number(opts.min, opts.max, opts.decimals);
      case "date":
        return dateValue(kind || "date", opts.minDays, opts.maxDays);
      case "email":
        return generateEmail(opts, identity);
      case "firstName":
        return identity ? identity.get("firstName", firstName) : firstName();
      case "middleName":
        return identity ? identity.get("middleName", firstName) : firstName();
      case "lastName":
        return identity ? identity.get("lastName", lastName) : lastName();
      case "fullName":
        return identity
          ? `${identity.get("firstName", firstName)} ${identity.get("lastName", lastName)}`
          : fullName();
      case "username":
        return identity ? identity.get("username", username) : username();
      case "password":
        return opts.fixed ? opts.fixedValue || "" : password();
      case "telephone":
        return telephone(opts.template);
      case "url":
        return url();
      case "organization":
        return organization();
      case "address":
        return address();
      case "city":
        return city();
      case "state":
        return state();
      case "zip":
        return zip();
      case "country":
        return country();
      case "color":
        return color();
      case "list":
        return fromList(opts.values);
      case "regex":
        return (global.FF && global.FF.randexp && global.FF.randexp(opts.pattern || "")) || "";
      default:
        return "";
    }
  }

  global.FF = global.FF || {};
  global.FF.dataGenerator = { generate, pick, randInt, createIdentity };
})(typeof window !== "undefined" ? window : self);
