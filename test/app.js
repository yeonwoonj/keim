
var globalEval = eval;
var N = 250;

function preview() {
  var ta = document.querySelector('#input textarea');
  var div = document.querySelector('#output');
  div.innerHTML = Keim.process(ta.value);
}

var keim;
function rekeim() {
  var updated=false;
  var req = new XMLHttpRequest();
  req.open('get', '/keim.js', false);
  req.onreadystatechange = function() {
    if (req.readyState==4) {
      if (keim!=req.responseText) {
        keim = req.responseText;
        globalEval(keim);
        updated=true;
        console.debug('Keim updated: '+new Date());
      }
    }
  };
  req.send(null);
  return updated;
}

var text = "";
var preview_timeout_id = null;
function watch() {
  var ta = document.querySelector('#input textarea');
  if (text != ta.value || rekeim()) {
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
}

window.onload = main;
