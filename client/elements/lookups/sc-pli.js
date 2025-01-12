import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
import '@polymer/iron-ajax/iron-ajax.js';

import { ReduxMixin } from '../../redux-store.js';
import { API_ROOT } from '../../constants.js';

class SCPaliLookup extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
    <iron-ajax
        id="ajax"
        handle-as="json"
        loading="{{loadingDict}}"
        last-response="{{dictData}}"></iron-ajax>`;
  }

  static get properties() {
    return {
      syllSpacer: {
        type: String,
        value: '‧'
      },
      dictData: {
        type: Object
      },
      loadingDict: {
        type: Boolean,
        value: true
      },
      isTi: {
        type: Boolean
      },
      loadedLanguage: {
        type: String
      },
      toLang: {
        type: String,
        statePath: 'textOptions.paliLookupTargetLanguage',
        observer: '_targetLanguageChanged'
      }
    }
  }

  getNewDict() {
    this.$.ajax.url = this._computeUrl();
    this.loadedLanguage = this.toLang;
    return this.$.ajax.generateRequest();
  }

  lookupWord(word) {
    word = this._stripSpecialCharacters(word);
    word = word.toLowerCase().trim();
    word = word.replace(/­/g, '').replace(RegExp(this.syllSpacer, 'g'), '');//optional hyphen, syllable-breaker
    let meaning = '';

    word = word.replace(/ṃg/g, 'ṅg').replace(/ṃk/g, 'ṅk').replace(/ṃ/g, 'ṃ').replace(/Ṃ/g, 'ṃ');
    let allMatches = this._lookupWord(word);
    meaning = this._toHtml(allMatches, word);
    return { html: meaning };
  }

  _stripSpecialCharacters(word) {
    return word.replace(/(~|`|!|@|#|\$|%|\^|&|\*|\(|\)|{|}|\[|\]|;|:|\"|'|<|,|\.|>|\?|\/|\\|\||-|—​|_|\+|=|“)/g, '');
  }

  _computeUrl() {
    return `${API_ROOT}/dictionaries/lookup?from=pli&to=${this.toLang}`;
  }

  _targetLanguageChanged() {
    if (this.toLang && this.toLang !== this.loadedLanguage) {
      this.getNewDict();
    }
  }

  _toHtml(allMatches, original) {
    let out = '';
    if (allMatches.length === 0) {
      allMatches.push({ 'base': original, 'meaning': '?' });
    }
    if (this.isTi) allMatches.push({ 'base': 'iti', 'meaning': 'endquote' });
    for (let match of allMatches) {
      let href = '/define/' + match.base;
      if (out) {
        out += ' + ';
      }
      out += '<a href="' + href + '" target="_blank" rel="noopener" class="lookup-link">' + match.base + '</a>: ' + match.meaning;
    }
    return out;
  }

  _lookupWord(word) {
    let allMatches = [];

    this.isTi = false;
    if (word.match(/[’”]ti$/)) {
      this.isTi = true;
      word = word.replace(/[’”]ti$/, '');
    }
    word = word.replace(/[’”]/g, '');
    let unword = null; //The un-negated version.

    //First we try to match the word as-is
    let m = this.matchComplete(word, { 'ti': this.isTi });
    if (!m || m.length === 0) {
      if (word.search(/^an|^a(.)\1/) !== -1) {
        unword = word.substring(2, word.length);
      }
      else if (word.search(/^a/) !== -1) {
        unword = word.substring(1, word.length);
      }

      if (unword) {
        m = this.matchComplete(unword, { 'ti': this.isTi });
        if (m && m.length > 0) {
          allMatches.push({ 'base': 'an', 'meaning': 'non/not' });
        }
      }
    }
    if (m && m.length > 0) {
      allMatches = allMatches.concat(m);
    }

    if (allMatches.length === 0) {
      //Now we attempt to break up the compound.
      //First is special case since 'an' is possibility.
      m = this.matchPartial(word);
      if (unword) {
        let unm = this.matchPartial(unword);
        if ((unm && !m) || (unm && m && unm.base.length > m.base.length)) {
          m = unm;
          allMatches.push({ 'base': 'an', 'meaning': 'non/not' });
        }
      }
      let foundComplete = false;
      while (m && !foundComplete) {
        if (m instanceof Array && m.length === 1) {
          m = m[0];
        }
        allMatches = allMatches.concat(m);
        let leftover = m.leftover;
        let firstchar = '';
        let sandhi = m.base[m.base.length - 1];
        if (leftover) {
          firstchar = leftover[0];
          leftover = leftover.substring(1, leftover.length);
        } else {
          break;
        }
        let starts = [firstchar, '', sandhi + firstchar];
        let vowels = ['a', 'ā', 'i', 'ī', 'u', 'ū', 'o', 'e'];
        //As a rule sandhi doesn't shortern vowels
        if (sandhi === 'a' || sandhi === 'i' || sandhi === 'u') {
          vowels = ['a', 'i', 'u'];
        }
        for (let i in vowels) {
          starts.push(vowels[i] + firstchar);
        }
        for (let i in starts) {
          m = this.matchComplete(starts[i] + leftover, { 'ti': this.isTi });
          if (m && m.length > 0) {
            allMatches = allMatches.concat(m);
            foundComplete = true;
            break;
          }
          m = this.matchPartial(starts[i] + leftover);
          if (m) {
            break
          }
        }
        if (!m) {
          let base = firstchar + leftover;
          if (base !== 'ṃ') {
            allMatches.push({ 'base': base, 'meaning': '?' });
          }
          break;
        }
      }
      //In the long run it would be nice to implement 'two ended candle' match.
    }

    return allMatches;
  }

  matchComplete(word, args) {
    let matches = [];
    for (let pi = 0; pi < 2; pi++) // 'pi (list)
      for (let vy = 0; vy < 2; vy++) // vy / by (burmese)
        for (let ti = 0; ti < 2; ti++) { // 'ti (end quote)
          //On the first pass change nothing.
          let wordp = word;
          //On the second pass we change the last vowel if 'ti', otherwise skip.
          if (ti && args.ti === true) {
            wordp = wordp.replace(/ī$/, 'i').replace(/ā$/, 'i').replace(/ū$/, 'i').replace(/n$/, '').replace(/n$/, 'ṃ');
          }
          if (pi) {
            if (wordp.search(/pi$/) === -1) {
              continue;
            }
            wordp = wordp.replace(/pi$/, '');
          }
          if (vy) {
            if (wordp.match(/vy/)) {
              wordp = wordp.replace(/vy/g, 'by');
            } else if (wordp.match(/by/)) {
              wordp = wordp.replace(/by/g, 'vy');
            } else {
              continue;
            }
          }

          let m = this.exactMatch(wordp) || this.fuzzyMatch(wordp);
          if (m) {
            matches.push(m);
            if (pi) {
              matches.push({ 'base': 'pi', 'meaning': 'too' });
            }
            return matches;
          }
        }

    return null;
  }

  matchPartial(word, maxlength) {
    if (!this.dictData) {
      return;
    }
    //Matching partials is somewhat simpler, since all ending cases are clipped off.
    for (let vy = 0; vy < 2; vy++) {
      let wordp = word;
      if (vy) {
        if (wordp.match(/vy/)) {
          wordp = wordp.replace(/vy/g, 'by');
        } else if (wordp.match(/by/)) {
          wordp = wordp.replace(/by/g, 'vy');
        } else {
          continue;
        }
      }

      if (!maxlength) {
        maxlength = 4;
      }
      for (let i = 0; i < word.length; i++) {
        let part = word.substring(0, word.length - i);
        if (part.length < maxlength) {
          break;
        }
        let target = this.dictData.dictionary[part];
        if (typeof (target) === 'object') {
          let meaning = target[1];
          if (meaning === undefined) {
            meaning = target[0];
          }

          return {
            'base': part,
            'meaning': meaning,
            'leftover': word.substring(word.length - i, word.length)
          }
        }
      }
    }
  }

  //Every match should return an object containing:
  // "base": The base text being matched
  // "meaning": The meaning of the matched text.
  // "leftovers": Anything which wasn't matched by the function, should be empty string
  //  or null if meaningless (such as a grammatical insertion ie. 'ti')
  exactMatch(word) {
    if (!this.dictData) {
      return;
    }
    let target = this.dictData.dictionary[word];
    if (typeof (target) === 'object') {
      let meaning = '';
      if (target[1] === undefined) {
        meaning = target[0];
      } else {
        meaning = `${target[1]} (${target[0]})`;
      }
      return { 'base': word, 'meaning': meaning };
    }
    return null;
  }

  fuzzyMatch(word) {
    let end = this._getEndings();
    for (let i = 0; i < end.length; i++) {
      if (word.length > end[i][2] && word.substring(word.length - end[i][0].length, word.length) === end[i][0]) {
        let orig = word.substring(0, word.length - end[i][0].length + end[i][1]) + end[i][3];
        let target = this.dictData.dictionary[orig];
        if (typeof (target) === 'object') {
          let meaning = '';
          if (target[1] === undefined) {
            meaning = target[0];
          } else {
            meaning = `${target[1]} (${target[0]})`;
          }
          return { 'base': orig, 'meaning': meaning };
        }
      }
    }
    return null;
  }

  _getEndings() {
    return [
      ['i', 1, 0, ''],
      ['u', 1, 0, ''],
      ['ati', 1, 0, ''],
      ['āti', 1, 0, ''],
      ['eti', 1, 0, ''],
      ['oti', 1, 0, ''],
      ['o', 0, 0, 'a'],
      ['ā', 0, 0, 'a'],
      ['aṁ', 1, 0, ''],
      ['ṁ', 0, 0, ''],
      ['e', 0, 0, 'a'],
      ['ena', 0, 0, 'a'],
      ['ehi', 0, 0, 'a'],
      ['ebhi', 0, 0, 'a'],
      ['āya', 0, 0, 'a'],
      ['ssa', 0, 0, ''],
      ['ānaṁ', 0, 0, 'a'],
      ['smā', 0, 0, ''],
      ['mhā', 0, 0, ''],
      ['smiṁ', 0, 0, ''],
      ['mhi', 0, 1, ''],
      ['esu', 0, 0, 'a'],
      ['ayo', 0, 1, 'i'],
      ['ī', 1, 1, ''],
      ['inā', 1, 1, ''],
      ['īhi', 1, 1, ''],
      ['hi', 0, 2, ''],
      ['ībhi', 1, 1, ''],
      ['bhi', 0, 1, ''],
      ['ino', 1, 1, ''],
      ['īnaṁ', 1, 1, ''],
      ['īsu', 1, 1, ''],
      ['i', 1, 2, 'i'],
      ['inaṁ', 1, 0, ''],
      ['avo', 0, 1, 'u'],
      ['ave', 0, 1, 'u'],
      ['ū', 1, 1, ''],
      ['unā', 1, 1, ''],
      ['ūhi', 1, 1, ''],
      ['ūbhi', 1, 1, ''],
      ['uno', 1, 1, ''],
      ['ūnaṁ', 1, 1, ''],
      ['ūsu', 1, 1, ''],
      ['u', 1, 2, 'u'],
      ['āni', 0, 2, 'a'],
      ['īni', 1, 2, ''],
      ['ūni', 1, 2, ''],
      ['a', 1, 2, 'a'],
      ['āyo', 0, 0, 'a'],
      ['āhi', 0, 0, 'a'],
      ['ābhi', 0, 0, 'a'],
      ['āyaṁ', 0, 0, 'a'],
      ['āsu', 0, 0, 'a'],
      ['iyo', 1, 0, ''],
      ['iyā', 1, 0, ''],
      ['iyaṁ', 1, 0, ''],
      ['iyā', 0, 0, 'ī'],
      ['iyaṁ', 0, 0, 'ī'],
      ['iyaṁ', 0, 0, 'i'],
      ['āya', 0, 0, 'ī'],
      ['ī', 0, 0, 'a'],
      ['inī', 0, 0, 'a'],
      ['uyo', 1, 0, ''],
      ['uyā', 1, 0, ''],
      ['uyaṁ', 1, 0, ''],
      ['ā', 0, 3, 'ant'],
      ['a', 1, 3, 'nt'],
      ['ataṁ', 1, 3, 'nt'],
      ['antaṁ', 1, 3, 'nt'],
      ['anto', 1, 3, 'nt'],
      ['antā', 1, 3, 'nt'],
      ['ante', 1, 3, 'nt'],
      ['atā', 1, 3, 'nt'],
      ['antehi', 1, 3, 'nt'],
      ['ato', 1, 3, 'nt'],
      ['antānaṁ', 1, 3, 'nt'],
      ['ati', 1, 3, 'nt'],
      ['antesu', 1, 3, 'nt'],
      ['ā', 0, 3, 'anta'],
      ['a', 1, 3, 'nta'],
      ['ataṁ', 1, 3, 'nta'],
      ['ataṁ', 1, 3, 'ti'],
      ['antaṁ', 1, 3, 'nta'],
      ['anto', 1, 3, 'nta'],
      ['antā', 1, 3, 'nta'],
      ['ante', 1, 3, 'nta'],
      ['atā', 1, 3, 'nta'],
      ['antehi', 1, 3, 'nta'],
      ['ato', 1, 3, 'nta'],
      ['antānaṁ', 1, 3, 'nta'],
      ['ati', 1, 3, 'nta'],
      ['antesu', 1, 3, 'nta'],
      ['ā', 0, 2, 'ar'],
      ['āraṁ', 0, 2, 'ar'],
      ['ārā', 0, 2, 'ar'],
      ['u', 0, 2, 'ar'],
      ['uno', 0, 2, 'ar'],
      ['ari', 0, 2, 'ar'],
      ['āro', 0, 2, 'ar'],
      ['ūhi', 0, 2, 'ar'],
      ['ūbhi', 0, 2, 'ar'],
      ['ūnaṁ', 0, 2, 'ar'],
      ['ārānaṁ', 0, 2, 'ar'],
      ['ūsu', 0, 2, 'ar'],
      ['ā', 0, 2, 'ar'],
      ['a', 0, 2, 'ar'],
      ['araṁ', 0, 2, 'ar'],
      ['arā', 0, 2, 'ar'],
      ['aro', 0, 2, 'ar'],
      ['unā', 0, 2, 'ar'],
      ['arehi', 0, 2, 'ar'],
      ['arebhi', 0, 2, 'ar'],
      ['ānaṁ', 0, 2, 'ar'],
      ['arānaṁ', 0, 2, 'ar'],
      ['unnaṁ', 0, 2, 'ar'],
      ['ito', 0, 2, 'ar'],
      ['uyā', 0, 2, 'ar'],
      ['yā', 0, 2, 'ar'],
      ['yaṁ', 0, 2, 'ar'],
      ['uyaṁ', 0, 2, 'ar'],
      ['aṁ', 0, 0, 'ā'],
      ['āya', 0, 0, 'ā'],
      ['asā', 0, 0, 'o'],
      ['aso', 0, 0, 'o'],
      ['asi', 0, 0, 'o'],
      ['ā', 0, 0, 'o'],
      ['aṁ', 0, 0, 'o'],
      ['e', 0, 0, 'o'],
      ['ena', 0, 0, 'o'],
      ['ehi', 0, 0, 'o'],
      ['ebhi', 0, 0, 'o'],
      ['āya', 0, 0, 'o'],
      ['assa', 0, 0, 'o'],
      ['ānaṁ', 0, 0, 'o'],
      ['asmā', 0, 0, 'o'],
      ['amhā', 0, 0, 'o'],
      ['asmiṁ', 0, 0, 'o'],
      ['amhi', 0, 0, 'o'],
      ['esu', 0, 0, 'o'],
      ['ato', 1, 2, 'ti'],
      ['atā', 1, 2, 'ti'],
      ['ato', 1, 2, 'ati'],
      ['atā', 1, 2, 'ati'],
      ['eto', 1, 2, 'ti'],
      ['etā', 1, 2, 'ti'],
      ['oto', 1, 2, 'ti'],
      ['otā', 1, 2, 'ti'],
      ['ahi', 1, 1, ''],
      ['to', 0, 2, ''],
      ['annaṁ', 1, 1, ''],
      ['unnaṁ', 1, 1, ''],
      ['innaṁ', 1, 1, ''],
      ['atā', 2, 1, 'i'],
      ['iya', 0, 2, 'a'],
      ['uyaṁ', 0, 0, ''],
      ['ati', 3, 0, ''],
      ['āti', 3, 0, ''],
      ['eti', 3, 0, ''],
      ['oti', 3, 0, ''],
      ['anti', 1, 0, 'ti'],
      ['si', 0, 3, 'ti'],
      ['asi', 1, 0, 'ti'],
      ['atha', 1, 0, 'ati'],
      ['āmi', 0, 0, 'ati'],
      ['āma', 0, 0, 'ati'],
      ['āmi', 1, 0, 'ti'],
      ['āma', 1, 0, 'ti'],
      ['onti', 1, 0, 'ti'],
      ['osi', 1, 0, 'ti'],
      ['otha', 1, 0, 'ti'],
      ['omi', 1, 0, 'ti'],
      ['oma', 1, 0, 'ti'],
      ['enti', 1, 0, 'ti'],
      ['esi', 1, 0, 'ti'],
      ['etha', 1, 0, 'ti'],
      ['emi', 1, 0, 'ti'],
      ['ema', 1, 0, 'ti'],
      ['hi', 0, 3, 'ti'],
      ['atu', 1, 2, 'ti'],
      ['antu', 1, 1, 'ti'],
      ['ohi', 1, 0, 'ti'],
      ['otu', 1, 0, 'ti'],
      ['ontu', 1, 0, 'ti'],
      ['etu', 1, 0, 'ti'],
      ['entu', 1, 0, 'ti'],
      ['ehi', 1, 0, 'ti'],
      ['eti', 0, 2, 'ati'],
      ['enti', 0, 2, 'ati'],
      ['esi', 0, 2, 'ati'],
      ['etha', 0, 2, 'ati'],
      ['emi', 0, 2, 'ati'],
      ['ema', 0, 2, 'ati'],
      ['eti', 0, 2, 'āti'],
      ['enti', 0, 2, 'āti'],
      ['esi', 0, 2, 'āti'],
      ['etha', 0, 2, 'āti'],
      ['emi', 0, 2, 'āti'],
      ['ema', 0, 2, 'āti'],
      ['entu', 0, 2, 'ati'],
      ['ayitvā', 0, 2, 'eti'],
      ['ayitvāna', 0, 2, 'eti'],
      ['vāna', 0, 2, 'i'],
      ['āpetvā', 0, 0, 'ati'],
      ['itvāna', 0, 0, 'ati'],
      ['itvāna', 0, 0, 'āti'],
      ['itvāna', 0, 0, 'eti'],
      ['etvāna', 0, 0, 'ati'],
      ['tvāna', 0, 0, 'ti'],
      ['itvā', 0, 0, 'ati'],
      ['itvā', 0, 0, 'āti'],
      ['itvā', 0, 0, 'eti'],
      ['etvā', 0, 0, 'ati'],
      ['tvā', 0, 0, 'ti'],
      ['āya', 0, 0, 'ati'],
      ['āya', 0, 0, 'ati'],
      ['āya', 0, 0, 'āti'],
      ['āya', 0, 0, 'eti'],
      ['tuṁ', 0, 0, 'ti'],
      ['ituṁ', 0, 0, 'ati'],
      ['ituṁ', 0, 0, 'āti'],
      ['a', 0, 3, 'ati'],
      ['i', 0, 3, 'ati'],
      ['imha', 0, 0, 'ati'],
      ['imhā', 0, 0, 'ati'],
      ['iṁsu', 0, 1, 'ati'],
      ['ittha', 0, 0, 'ati'],
      ['uṁ', 0, 0, 'ati'],
      ['suṁ', 0, 0, 'ti'],
      ['siṁ', 0, 0, 'ti'],
      ['iṁ', 0, 0, 'ati'],
      ['a', 0, 3, 'āti'],
      ['i', 0, 3, 'āti'],
      ['imha', 0, 0, 'āti'],
      ['imhā', 0, 0, 'āti'],
      ['iṁsu', 0, 1, 'āti'],
      ['ittha', 0, 0, 'āti'],
      ['uṁ', 0, 0, 'āti'],
      ['iṁ', 0, 0, 'āti'],
      ['a', 0, 3, 'eti'],
      ['i', 0, 3, 'eti'],
      ['imha', 0, 0, 'eti'],
      ['imhā', 0, 0, 'eti'],
      ['iṁsu', 0, 1, 'eti'],
      ['ayiṁsu', 0, 1, 'eti'],
      ['ittha', 0, 0, 'eti'],
      ['uṁ', 0, 0, 'eti'],
      ['iṁ', 0, 0, 'eti'],
      ['iyaṁ', 0, 0, 'eti'],
      ['eyya', 0, 0, 'ati'],
      ['eyyaṁ', 0, 0, 'ati'],
      ['eyyuṁ', 0, 0, 'ati'],
      ['eyyati', 0, 0, 'ati'],
      ['eyyasi', 0, 0, 'ati'],
      ['eyyātha', 0, 0, 'ati'],
      ['eyyāmi', 0, 0, 'ati'],
      ['eyyāsi', 0, 0, 'ati'],
      ['eyyāma', 0, 0, 'ati'],
      ['eyyanti', 0, 0, 'ati'],
      ['eyya', 0, 0, 'āti'],
      ['eyyaṁ', 0, 0, 'āti'],
      ['eyyuṁ', 0, 0, 'āti'],
      ['eyyati', 0, 0, 'āti'],
      ['eyyasi', 0, 0, 'āti'],
      ['eyyātha', 0, 0, 'āti'],
      ['eyyāmi', 0, 0, 'āti'],
      ['eyyāsi', 0, 0, 'āti'],
      ['eyyāma', 0, 0, 'āti'],
      ['eyyanti', 0, 0, 'āti'],
      ['eyya', 1, 0, 'ti'],
      ['eyyaṁ', 1, 0, 'ti'],
      ['eyyuṁ', 1, 0, 'ti'],
      ['eyyati', 1, 0, 'ti'],
      ['eyyasi', 1, 0, 'ti'],
      ['eyyātha', 1, 0, 'ti'],
      ['eyyāmi', 1, 0, 'ti'],
      ['eyyāsi', 1, 0, 'ti'],
      ['eyyāma', 1, 0, 'ti'],
      ['eyyanti', 1, 0, 'ti'],
      ['eyya', 0, 0, 'oti'],
      ['eyyaṁ', 0, 0, 'oti'],
      ['eyyuṁ', 0, 0, 'oti'],
      ['eyyati', 0, 0, 'oti'],
      ['eyyasi', 0, 0, 'oti'],
      ['eyyātha', 0, 0, 'oti'],
      ['eyyāmi', 0, 0, 'oti'],
      ['eyyāsi', 0, 0, 'oti'],
      ['eyyāma', 0, 0, 'oti'],
      ['eyyanti', 0, 0, 'oti'],
      ['issa', 0, 2, 'ati'],
      ['issā', 0, 2, 'ati'],
      ['issaṁsu', 0, 2, 'ati'],
      ['issatha', 0, 2, 'ati'],
      ['issaṁ', 0, 2, 'ati'],
      ['issāmi', 0, 2, 'ati'],
      ['issati', 0, 3, 'ati'],
      ['issāma', 0, 2, 'ati'],
      ['issa', 0, 2, 'āti'],
      ['issā', 0, 2, 'āti'],
      ['issaṁsu', 0, 2, 'āti'],
      ['issa', 0, 2, 'āti'],
      ['issatha', 0, 2, 'āti'],
      ['issaṁ', 0, 2, 'āti'],
      ['issāma', 0, 2, 'āti'],
      ['essa', 1, 2, 'ti'],
      ['essā', 1, 2, 'ti'],
      ['essaṁsu', 1, 2, 'ti'],
      ['essa', 1, 2, 'ti'],
      ['essatha', 1, 2, 'ti'],
      ['essaṁ', 1, 2, 'ti'],
      ['essāma', 1, 2, 'ti'],
      ['issanti', 0, 3, 'ati']
    ];
  }
}

customElements.define('sc-pali-lookup', SCPaliLookup);
