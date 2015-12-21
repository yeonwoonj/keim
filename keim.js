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

// custom string prototype functions

String.prototype.count = function(sub,beg,end) {
  var c=0;
  var p=beg||0;
  var e=end||this.length;
  while ((p=this.indexOf(sub,p))!=-1 && (p+=sub.length)<=e) {
    c+=1;
  }
  return c;
}

String.prototype.htmlencode = function() {
  return this.replace(/</g,'&lt;')
             .replace(/>/g,'&gt;');
}


// the global Keim object

var Keim = (function(Keim) {

  var _Stream = function(t) {
    return {
      text: t,
      rpos: 0,
      good: function() {
        return this.rpos < this.text.length;
      },
      peek: function() {
        return this.text.substr(this.rpos);
      },
      seek: function(offset) {
        this.rpos += offset;
      },
      exec: function(re) {
        var m = re.exec(this.peek());
        if (m)
          this.seek(m[0].length);
        return m;
      },
      readline: function() {
        var m = /.*\n?/m.exec(this.peek());
        this.seek(m[0].length);
        return m[0];
      },
      readcell: function() {
        var m = /^ *\n|^\s*$|^\s*([^]+?)(?=\|\||$)/.exec(this.peek());
        this.seek(m[0].length);
        return m[1];
      },
    };
  }
  /* tag processors */

  var TP = {
    name: null,
    wrap: function(o,tag) {
      return '<'+(tag||this.name)+(this.attr||'')+'>'+o+'</'+(tag||this.name)+'>';
    },
    make: function(ctx) {
      return Object.create(this, {
        ctx: {value: ctx}
      });
    },
    html: function(m) {
      return _process(_Stream(m),this.ctx);
    },
    regx: null,
    re: function() {
      return new RegExp(this.regx.source, this.regx.flags);
    },
    peek: function(s) {
      return (this.regx==null)||this.re().test(s.peek());
    },
  }

  var _TP = function(name,re,fun) {
    var o = Object.create(TP);
    o.name = name;
    o.regx = re;
    o.read = fun;
    return o;
  };

  var List = _TP('ol', /^( +)(\*|[1iIaA]\.(?:#(\d+))?) */, function(s) {
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
    while (m = s.exec(re)) {
      var [_,depth,sign,num] = m;
      var d = depth.length;
      var line = s.readline();
      if (sign) {
        if (d>last()) {
          html += open(d);
        } else {
          html += close(d);
        }
        html += li(sign,num,this.html(line));
      } else {
        html += this.html(line);
      }
    }
    html += close(0);
    return html;
  });

  var Blockquote = _TP('blockquote', /^( *)>+ */, function(s) {
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
    while (m = s.exec(this.re())) {
      var [_,depth] = m;
      var d = depth.length;
      if (d!=last) {
        if (0<=last) {
          html += close(last);
        }
        html += open(d);
      }
      html += this.html(s.readline());
    }
    html += close(last);
    return html;
  });

  var Indent = _TP('div', /^ /, function(s) {
    var html='';
    var m;
    while (m = s.exec(this.re())) {
      html += this.html(s.readline());
      if (Blockquote.peek(s)) {
        break;
      }
    }
    this.attr = ' class="indent"';
    return this.wrap(html);
  });

  var Table = _TP('table', /^(?:\|\|)+/, function(s) {
    var html='';

    var table = {
      on: false,
      attr: function(p) {
        var cls=[],sty=[];
        var stk = {
          'bgcolor': 'background-color',
          'bordercolor': 'border-color',
          'width': 'width',
        };
        var re = /<table\s*?(\w+)=(\w+)>/g;
        var m;
        while (m = re.exec(p)) {
          var [_,k,v] = m;
          switch (k.toLowerCase()) {
            case 'align':
              cls.push('table-'+v);
              break;
            case 'bgcolor':
            case 'bordercolor':
            case 'width':
              sty.push(stk[k]+':'+v);
              break;
          }
        }
        var attr='';
        if (cls.length) attr += ' class="'+cls.join(' ')+'"';
        if (sty.length) attr += ' style="'+sty.join(' ')+'"';
        return attr;
      },

      tr: {
        on: false,
        open: function(attr) { this.on = true; return '<tr'+attr+'>'; },
        close: function() { this.on = false; return '</tr>'; },
      },
      td: {
        open: function(attr) { return '<td'+attr+'>'; },
        close: function() { return '</td>'; },
        attr: function(b,t) {
          var c=b.length/2;
          var r=1;
          var cls=[],sty=[];

          var m;

          var re1 = /<([\^v]?)([\(:\)-\|])(\d+)?>/g
          while (m = re1.exec(t)) {
            var [_,f,k,v] = m;
            if (k=='(') {
              cls.push('table-row-left');
            } else if (k==':') {
              cls.push('table-row-center');
            } else if (k==')') {
              cls.push('table-row-right');
            } else if (k=='-') {
              c=v;
            } else if (k=='|') {
              r=v;
              if (f=='^') {
                sty.push('vertical-align:top');
              } else if (f=='v') {
                sty.push('vertical-align:bottom');
              } else {
                sty.push('vertical-align:middle');
              }
            }
          }

          var re2 = /<(?:(\w+)=)?([#%\w]+)>/g;
          while (m = re2.exec(t)) {
            var [_,k,v] = m;
            switch ((k||'').toLowerCase()) {
              case '':
              case 'bgcolor':
                sty.push('background-color:'+v);
                break;
              case 'rowbgcolor':
                // TODO
                break;
              case 'width':
              case 'height':
                sty.push(k+':'+v);
                break;
            }
          }
          var attr='';
          if (c>1) { attr += ' colspan='+c; }
          if (r>1) { attr += ' rowspan='+r; }
          if (cls.length) { attr += ' class="'+cls.join(' ')+'"'; }
          if (sty.length) { attr += ' style="'+sty.join(';')+'"'; }
          return attr;
        },
      },
    }
    this.attr='';

    var re = /^(?:(\|\|)((?:<.+?>)+))?((?:\|\|)+)/;
    var m;
    while (m = s.exec(re)) {
      var [_,b1,p,b2] = m;
      var b = (b1||'')+b2;
      var cell = s.readcell();
      if (cell) {
        if (table.tr.on) {
          html += table.td.close();
        } else {
          html += table.tr.open('');
        }
        html += table.td.open(table.td.attr(b,cell));
        this.attr += table.attr(cell);

        cell = cell.replace(/<.+?>/g,'');
        html += this.html(cell);
      } else {
        html += table.td.close() + table.tr.close();
      }
      if (p) {
        this.attr += table.attr(p);
      }
    }
    return this.wrap(html);
  });

  var HRule = _TP('hr', /^-{4}/, function(s) {
    var line = s.readline();
    if (line.search(/^-{11}/)!=-1) {
      return line;
    }
    return '<hr>';
  });

  var Heading = _TP('h', /^(={1,6}) +(.+?) +\1 */, function(s) {
    var toc = this.ctx.toc;
    var m = s.exec(this.re());
    var [_,h,l] = m;
    var hn = h.length;

    var pd=toc.d[toc.d.length-1]||0;
    if (hn>pd) {
      toc.n.push(1);
    } else {
      var n,d;
      do {
        n = toc.n.pop();
        d = toc.d.pop();
      } while (d!=hn&&toc.d.length);
      toc.n.push(n+1);
    }
    toc.d.push(hn);
    var num=toc.n.join('.');
    var html = this.html(l);
    toc.l.push('<li style="margin-left:'+toc.n.length+'em"><a href="#s-'+num+'">'+num+'.</a> '+html+'</li>');

    html = '<h'+hn+' id="s-'+num+'"><a href="#toc">'+num+'.</a> '+html+'</h'+hn+'>';
    html += this.html(s.readline());
    return html;
  });

  var Footnote = _TP(null, /\[\*(\S+)? +/g, function(line) {
    var ctx = this.ctx;

    var replacer = function(line,re,o,c,fun) {
      do {
        var m = re.exec(line);
        if (m) {
          var beg = m.index;
          var end = beg;
          var num=0;
          while ((end=line.indexOf(c,end))!=-1) {
            num+=1;
            end+=c.length;
            if (line.count(o,beg,end)==num) {
              var txt = line.substring(beg+m[0].length, end-c.length);
              line = line.substr(0,beg)+fun(m,txt)+line.substr(end);
              re.lastIndex=end;
              break;
            }
          }
        }
      } while(re.global && m);
      return line;
    }

    return replacer(line, this.re(), '[', ']', function([_1,tag],txt) {
      var c = ctx.fn.length+1;
      tag = tag||c;
      ctx.fn.push('<a id="rfn-'+c+'" href="#fn-'+c+'">['+tag+']</a> '+txt);
      return '<sup id="fn-'+c+'" title="'+txt.replace(/<.*?>/g,'')+'"><a href="#rfn-'+c+'">['+tag+']</a></sup>';
    });
  });

  var Excludes = _TP('code', /^(.*?){{{(?:#!html|(?!#\w+ |\+[1-5] ))[^]*?}}}/i, function(s) {
    var html='';

    var text = s.peek();

    var [_,part] = this.re().exec(text);
    var pos = part.length;
    if (pos) {
      html += Default.read(_Stream(part));
      s.seek(pos);
      text = text.substr(pos);
    }

    var num=0;
    var end=0;
    while ((end=text.indexOf('}}}',end))!=-1) {
      num+=1;
      end+=3;
      if (text.count('{{{',0,end)==num) {
        s.seek(end);
        break;
      }
    }

    if (end==-1) { // when brackets are not closed properly
      html += Default.read(s);
      return html;
    }

    text = text.substring(3,end-3);
    if (text.substr(0,6).toLowerCase()=='#!html') {
      html += text.substr(6);
    } else {
      var pre = text.indexOf('\n')!=-1;
      text = text.htmlencode();
      if (pre) {
        text = text.replace(/^\n+/,'');
        html += this.wrap(this.wrap(text),'pre');
      } else {
        html += this.wrap(text);
      }
    }
    html += Default.read(s);
    return html;
  });

  var Stub = _TP(null, null, function(line) {
    line = line.replace(/\[(목차|tableofcontents)\]/ig, '<ol id="toc">목차'+this.ctx.toc.l.join('')+'</ol>');

    line = line.replace(/\[(각주|footnote)\]/ig, '');
    line = Footnote.make(this.ctx).read(line);
    line += '<hr>'+this.ctx.fn.join('<br>');
    return line;
  });

  var File = _TP('span', null, function(line) {
    line = line.replace(/\[\[:?파일:.+?\]\]/g, '<span class="file-truncated"/>');
    line = line.replace(/attachment:(\S+)/ig, '<span class="attachment-truncated"/>');

    // external images
    line = line.replace(/^https?:\/\/(\S+?)\.(jpg|jpeg|png|gif)(\S*)/ig, '<span class="image-truncated"/>');

    return line;
  });

  var Link = _TP('a', null, function(line) {
    var self = this;
    return line.replace(/\[\[(.+?)(?:\|(.+?))?\]\]/g, function(m,link,text) {
      self.attr = ' href="'+link+'"';
      if (link.indexOf('://')!=-1) {
        self.attr += ' class="external-link"';
      }
      return self.wrap(text||link);
    });
  });

  var Format = _TP(null, null, function(line) {
    line = line.replace(/\[br\]/g,'<br>');
    line = line.replace(/'''(.+?)'''/g,'<strong>$1</strong>');
    line = line.replace(/''(.+?)''/g,'<i>$1</i>');
    line = line.replace(/~~(.+?)~~/g,'<s>$1</s>');
    line = line.replace(/--(.+?)--/g,'<s>$1</s>');
    line = line.replace(/__(.+?)__/g,'<u>$1</u>');
    line = line.replace(/\^\^(.+?)\^\^/g,'<sup>$1</sup>');
    line = line.replace(/,,(.+?),,/g,'<sub>$1</sub>');
    line = line.replace(/{{{\+([1-5]) +(.*?)}}}(?!})/g,'<span class="font-size-$1">$2</span>');
    line = line.replace(/{{{(#[0-9a-f-A-F]{3}) +(.*?)}}}(?!})/g,'<span style="color:$1">$2</span>');
    line = line.replace(/{{{(#[0-9a-f-A-F]{6}) +(.*?)}}}(?!})/g,'<span style="color:$1">$2</span>');
    line = line.replace(/{{{#(\w+) +(.*?)}}}(?!})/g,'<span style="color:$1">$2</span>');
    return line;
  });

  var Default = _TP(null, null, function(s) {
    if (Excludes.peek(s)) {
      return Excludes.read(s);
    }
    var line = s.readline().htmlencode();
    line = File.read(line);
    line = Link.read(line);
    line = Format.read(line);
    return line.replace('\n','<br>');
  });
  /* end of tag processors */

  var parsers1 = [
    List,
    Blockquote,
    Indent,
    Table,
    Heading,
    HRule,
    Default,
  ];

  var _createMP = function(psrs) {
    var parsers = psrs;
    var _parser = function(s,c) {
      for (var i in parsers) {
        if (parsers[i].peek(s)) {
          return parsers[i].make(c);
        }
      }
    }
    var _read = function(s,c) {
      var p = _parser(s,c);
      return p.read(s);
    }

    return {
      process: function(s,c) {
        var html='';
        while (s.good()) {
          html += _read(s,c);
        }
        return html;
      },
    };
  };

  var _process = function(s,c,mp) {
    mp = mp||_createMP(parsers1);

    return mp.process(s,c);
  }

  // processor prototype
  var PP = function() {
    var Context = function() {
      this.toc  = {
        d: [],
        l: [],
        n: [],
      }
      this.fn = [];
    }
    this.html = function(markup) {
      var html='';
      var ctx = new Context();
      html = Stub.make(ctx).read(html);
      html = _process(_Stream(markup),ctx);
      html = Stub.make(ctx).read(html);
      return html;
    };
  }

  // instanciate PP and process markup text
  var _html = function(markup) {
    var processor = new PP();
    return processor.html(markup);
  }

  /* public functions */
  Keim.process = function(markup) {

    return _html(markup);
  }

  return Keim;
})(Keim||{});

