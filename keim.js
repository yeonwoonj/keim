/** Keim - Namu(Wiki) Markup Processor
 *
 *  Copyright (C) 2015  Yeonwoon JUNG <flow3r@gmail.com>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

var Keim = (function(Keim) {

  var _createText = function(t) {
    return {
      text: t,
      rpos: 0,
      good: function() {
        return this.rpos < this.text.length;
      },
      peek: function() {
        return this.text.substr(this.rpos);
      },
      fowd: function(len) {
        this.rpos += len;
      },
      exec: function(re) {
        var m = re.exec(this.peek());
        if (m)
          this.fowd(m[0].length);
        return m;
      },
      readline: function() {
        var m = /.*$/m.exec(this.peek());
        this.fowd(m[0].length+1);
        return m[0];
      },
      readcell: function() {
        var m = /^\n|^\s*$|^([\s\S]+?)(?=\|\||$)/.exec(this.peek());
        this.fowd(m[0].length);
        return m[1];
      },
    };
  }
  /* tag processors */

  var TP = {
    name: null,
    wrap: function(o) {
      return '<'+this.name+(this.attr||'')+'>'+o+'</'+this.name+'>';
    },
    make: function() {
      return Object.create(this);
    },
    regx: null,
    re: function() {
      return new RegExp(this.regx.source, this.regx.flags);
    },
    peek: function(t) {
      return (this.regx==null)||this.re().test(t.peek());
    },
  }

  var _TP = function(name,re,fun) {
    var o = Object.create(TP);
    o.name = name;
    o.regx = re;
    o.read = fun;
    return o;
  };

  var List = _TP('ol', /^( +)(\*|[1iIaA]\.(?:#(\d+))?) */, function(t) {
    var html='';
    var lists = [];
    var last = function() {
      return lists[lists.length-1]||0;
    }
    var open = function(d) {
      lists.push(d);
      return '<ol>';
    }
    var close = function(d) {
      var html='';
      while (d<last()) {
        html += '</ol>';
        lists.pop();
      }
      return html;
    }
    var li = function(sign,num,o) {
      var attr='';
      var types = {
        '*': 'disc',
        '1.': 'decimal',
        'i.': 'lower-roman',
        'I.': 'upper-roman',
        'a.': 'lower-latin',
        'A.': 'upper-latin',
      };
      attr +=' style="list-style-type:'+types[sign]+';"';

      if (num) {
        attr += ' value="'+num+'"';
      }
      return '<li'+attr+'>'+o+'</li>';
    }
    var re = /^( +)(\*|[1iIaA]\.(?:#(\d+))?)? */;
    var m;
    while (m = t.exec(re)) {
      var [_,depth,sign,num] = m;
      var d = depth.length;
      var text = _createText(t.readline());
      if (sign) {
        if (d>last()) {
          html += open(d);
        } else {
          html += close(d);
        }
        html += li(sign,num,_process(text));
      } else {
        html += _process(text);
      }
    }
    html += close(0);
    return html;
  });

  var Blockquote = _TP('blockquote', /^( *)> */, function(t) {
    var html = '';
    var last = -1;
    var open = function(d) {
      var o='';
      last = d;
      while(d--) { o += '<div class="indent">'; }
      o += '<blockquote>';
      return o;
    }
    var close = function(d) {
      var o='';
      while (0<d--) { o += '</div>'; }
      o += '</blockquote>';
      return o;
    }
    var m;
    while (m = t.exec(this.re())) {
      var [_,depth] = m;
      var d = depth.length;
      if (d!=last) {
        if (0<=last) {
          html += close(last);
        }
        html += open(d);
      }
      var text = _createText(t.readline());
      html += _process(text);
    }
    html += close(last);
    return html;
  });

  var Indent = _TP('div', /^ /, function(t) {
    var html='';
    var m;
    while (m = t.exec(this.re())) {
      var text = _createText(t.readline());
      html += _process(text);
      if (Blockquote.peek(t)) {
        break;
      }
    }
    this.attr = ' class="indent"';
    return this.wrap(html);
  });

  var Table = _TP('table', /^(?:\|\|)+/, function(t) {
    var html='';

    var table = {
      tr: {
        on: false,
        open: function(attr) { this.on = true; return '<tr'+attr+'>'; },
        close: function() { this.on = false; return '</tr>'; }
      },
      td: {
        open: function(attr) { return '<td'+attr+'>'; },
        close: function() { return '</td>'; }
      },
    }

    var re = /^(?:(\|\|)((?:<.+?>)+))?((?:\|\|)+)/;
    var m;
    while (m = t.exec(re)) {
      var [_,b1,p,b2] = m;
      var b = (b1||'')+b2;
      var cell = t.readcell();
      if (cell) {
        if (table.tr.on) {
          html += table.td.close();
        } else {
          html += table.tr.open('');
        }
        var attr = ' colspan="'+(b.length/2)+'"';
        html += table.td.open(attr);

        var text = _createText(cell);
        html += _process(text);
      } else {
        html += table.td.close() + table.tr.close();
      }
    }
    this.attr = ' class=""';
    return this.wrap(html);
  });

  var Format = _TP(null, null, function(t) {
    var line = t.readline();
    line = line.replace(/\[\[(.+?)(?:\|(.+?))?\]\]/g, function(m,link,text) {
      return '<a href="http://namu.wiki/w/'+link+'">'+ (text||link) +'</a>';
    });
    line = line.replace(/~~(.+?)~~/g,'<s>$1</s>');
    line = line.replace(/'''(.+?)'''/g,'<strong>$1</strong>');
    line = line.replace(/''(.+?)''/g,'<em>$1</em>');
    line = line.replace(/\[br\]/g,'<br>');
    return line + '<br>';
  });

  var Default = _TP(null, null, function(t) {
    return t.readline() + '<br>';
  });
  /* end of tag processors */

  var parsers1 = [
    List,
    Blockquote,
    Indent,
    Table,
    Format,
    Default,
  ];

  var _createMP = function(psrs) {
    var parsers = psrs;
    var _parser = function(t) {
      for (var i in parsers) {
        if (parsers[i].peek(t)) {
          return parsers[i].make();
        }
      }
    }
    var _read = function(t) {
      var p = _parser(t);
      return p.read(t);
    }

    return {
      process: function(t) {
        var html='';
        while (t.good()) {
          html += _read(t);
        }
        return html;
      },
    };
  };

  var _process = function(t,mp) {
    mp = mp||_createMP(parsers1);

    return mp.process(t);
  }

  // processor prototype
  var PP = {
    text:'',
    html:'',
    process: function(markup) {
      this.text = markup;
      this.html = _process(_createText(markup));
      return this;
    },
  }

  // instanciate PP and process markup text
  var _processor = function(markup) {
    return Object.create(PP).process(markup);
  }

  /* public functions */
  Keim.process = function(markup) {

    return _processor(markup).html;
  }

  return Keim;
})(Keim||{});

