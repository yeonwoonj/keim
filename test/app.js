
var globalEval = eval;
var N = 500;

function preview() {
  var ta = document.querySelector('#input textarea');
  var div = document.querySelector('#output');
  div.innerHTML = Keim.process(ta.value);
}

function reload_ifchanged(url,chk,fun) {
  var head = new XMLHttpRequest();
  head.open('head', url);
  head.onreadystatechange = function() {
    if (head.readyState==2) {
      var t  = new Date(head.getResponseHeader('Last-Modified'));
      if (chk(t)) {
        var get = new XMLHttpRequest();
        get.open('get', url);
        get.onreadystatechange = function() {
          if (get.readyState==4) {
            fun(get.responseText);
          }
        }
        get.send();
      }
    }
  }
  head.send();
}

var last;
function rekeim() {
  reload_ifchanged('/keim.js', function(t) {
    if (last && t.valueOf()==last.valueOf()) {
      return false;
    }
    last = t;
    console.log('update detect: '+t);
    return true;
  }, function(t) {
    globalEval(t);
    console.log('update complete.');

    preview();
  });
}

var text = "";
var preview_timeout_id = null;
function watch() {
  var ta = document.querySelector('#input textarea');
  if (text != ta.value) {
    text = ta.value;

    if (preview_timeout_id) {
      window.clearTimeout(preview_timeout_id);
    }
    preview_timeout_id = window.setTimeout(preview, N*2);
  }
}

function main() {
  var btn = document.querySelector('#submit input');
  btn.onclick = preview;

  var ta = document.querySelector('#input textarea');
  ta.focus();

  window.setInterval(watch, N);
  window.setInterval(rekeim, N*5);
}

window.onload = main;
