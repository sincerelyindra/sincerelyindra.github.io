(function () {
  "use strict";
  if (typeof document === "undefined") return;
  document.documentElement.classList.add("robust-enhanced");

  var feasibility = {
    "1": [
      ["Beta(2,2)", 0.620, 1.000],
      ["Uniform(0,1)", 0.350, 0.996],
      ["Chi-squared(k=5)", 0.608, 1.000],
      ["Truncated normal", 0.674, 1.000]
    ],
    "0": [
      ["Beta(2,2)", 0.708, 1.000],
      ["Uniform(0,1)", 0.458, 0.996],
      ["Chi-squared(k=5)", 0.658, 1.000],
      ["Truncated normal", 0.752, 1.000]
    ]
  };

  var backtest = [
    ["Robust", 0.953, 0.807],
    ["ERM", 0.941, 0.747],
    ["Quadratic", 0.939, 0.745],
    ["Linear", 0.939, 0.740],
    ["Logit", 0.939, 0.739]
  ];

  var adaptive = {
    "0": [
      ["AdaptiveFeasible", 0.839, 1.000, 0.239, 0.901, true],
      ["AdaptiveValidated", 0.838, 1.000, 0.287, 0.939, true],
      ["Fixed90", 0.833, 0.989, 0.238, 0.900, false],
      ["Fixed95", 0.832, 0.997, 0.285, 0.950, false],
      ["Fixed99", 0.818, 1.000, 0.372, 0.990, false]
    ],
    "1": [
      ["AdaptiveFeasible", 0.847, 0.969, 0.245, 0.907, true],
      ["AdaptiveValidated", 0.847, 0.969, 0.293, 0.944, true],
      ["Fixed90", 0.819, 0.911, 0.236, 0.900, false],
      ["Fixed95", 0.823, 0.928, 0.283, 0.950, false],
      ["Fixed99", 0.841, 0.969, 0.370, 0.990, false]
    ]
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch];
    });
  }

  function renderFeasibility(alpha) {
    var svg = document.getElementById("feasibility-chart");
    var note = document.getElementById("feasibility-chart-note");
    if (!svg) return;
    var data = feasibility[String(alpha)];
    var W = 760, H = 320, left = 164, right = 36, top = 34, bottom = 42;
    var plotW = W - left - right;
    var rowH = 57;
    var parts = [];
    parts.push('<title id="feas-title">Exact versus interval quantile feasibility for alpha ' + esc(alpha) + '</title>');
    parts.push('<desc id="feas-desc">Four demand distributions. Exact plug-in quantiles have substantially lower feasibility than interval-valued quantiles. Values are taken from Table 1 of the project report.</desc>');
    for (var t = 0; t <= 10; t += 2) {
      var x = left + plotW * t / 10;
      parts.push('<line class="chart-grid" x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (H-bottom) + '"/>');
      parts.push('<text class="chart-small" x="' + x + '" y="' + (H-16) + '" text-anchor="middle">' + (t/10).toFixed(1) + '</text>');
    }
    parts.push('<line class="chart-axis" x1="' + left + '" y1="' + (H-bottom) + '" x2="' + (W-right) + '" y2="' + (H-bottom) + '"/>');
    data.forEach(function (d, i) {
      var y = top + i * rowH + 12;
      var exactW = plotW * d[1];
      var intW = plotW * d[2];
      parts.push('<text class="chart-label" x="' + (left-12) + '" y="' + (y+18) + '" text-anchor="end">' + esc(d[0]) + '</text>');
      parts.push('<rect class="chart-series-exact" x="' + left + '" y="' + y + '" width="' + exactW + '" height="14" rx="1"/>');
      parts.push('<rect class="chart-series-interval" x="' + left + '" y="' + (y+20) + '" width="' + intW + '" height="14" rx="1"/>');
      parts.push('<text class="chart-value" x="' + Math.min(left+exactW+7,W-33) + '" y="' + (y+11) + '">' + d[1].toFixed(3) + '</text>');
      parts.push('<text class="chart-value" x="' + Math.min(left+intW+7,W-33) + '" y="' + (y+31) + '">' + d[2].toFixed(3) + '</text>');
    });
    parts.push('<rect class="chart-series-exact" x="' + left + '" y="7" width="12" height="12"/><text class="chart-small" x="' + (left+18) + '" y="17">Exact plug-in</text>');
    parts.push('<rect class="chart-series-interval" x="' + (left+105) + '" y="7" width="12" height="12"/><text class="chart-small" x="' + (left+123) + '" y="17">Interval-valued</text>');
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = parts.join("");
    if (note) note.textContent = "α = " + alpha + " · feasibility rate";
    document.querySelectorAll("[data-feas-alpha]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-feas-alpha") === String(alpha)));
    });
  }

  function renderBacktest(metric) {
    var svg = document.getElementById("backtest-chart");
    var note = document.getElementById("backtest-chart-note");
    if (!svg) return;
    var idx = metric === "worst" ? 2 : 1;
    var W = 760, H = 310, left = 118, right = 52, top = 27, bottom = 43;
    var plotW = W-left-right, rowH = 46;
    var parts = [];
    var metricName = metric === "worst" ? "worst-decile revenue ratio" : "mean revenue ratio";
    parts.push('<title id="backtest-title">Historical backtest ' + metricName + '</title>');
    parts.push('<desc id="backtest-desc">Robust pricing leads ERM, quadratic, linear and logit baselines on the selected metric across 1,508 rolling windows.</desc>');
    for (var t=0;t<=10;t+=2) {
      var x = left + plotW*t/10;
      parts.push('<line class="chart-grid" x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (H-bottom) + '"/>');
      parts.push('<text class="chart-small" x="' + x + '" y="' + (H-16) + '" text-anchor="middle">' + (t/10).toFixed(1) + '</text>');
    }
    backtest.forEach(function(d,i){
      var y = top + i*rowH + 8;
      var value = d[idx];
      var width = plotW*value;
      parts.push('<text class="chart-label" x="' + (left-11) + '" y="' + (y+16) + '" text-anchor="end">' + esc(d[0]) + '</text>');
      parts.push('<rect class="' + (i===0 ? "chart-series-robust" : "chart-series-baseline") + '" x="' + left + '" y="' + y + '" width="' + width + '" height="20" rx="1"/>');
      parts.push('<text class="chart-value" x="' + Math.min(left+width+8,W-36) + '" y="' + (y+15) + '">' + value.toFixed(3) + '</text>');
    });
    parts.push('<line class="chart-axis" x1="' + left + '" y1="' + (H-bottom) + '" x2="' + (W-right) + '" y2="' + (H-bottom) + '"/>');
    svg.setAttribute("viewBox","0 0 "+W+" "+H);
    svg.innerHTML = parts.join("");
    if (note) note.textContent = metricName + " · higher is better";
    document.querySelectorAll("[data-backtest-metric]").forEach(function(b){
      b.setAttribute("aria-pressed",String(b.getAttribute("data-backtest-metric")===metric));
    });
  }

  function renderAdaptive(alpha) {
    var svg = document.getElementById("adaptive-chart");
    var note = document.getElementById("adaptive-chart-note");
    var summary = document.getElementById("adaptive-summary");
    if (!svg) return;
    var data = adaptive[String(alpha)];
    var W=760,H=390,left=84,right=47,top=32,bottom=62;
    var xMin=.22,xMax=.39,yMin=.80,yMax=.86;
    var xScale=function(v){return left+(v-xMin)/(xMax-xMin)*(W-left-right);};
    var yScale=function(v){return top+(yMax-v)/(yMax-yMin)*(H-top-bottom);};
    var parts=[];
    parts.push('<title id="adaptive-title">Adaptive confidence interval width versus mean revenue ratio for alpha ' + esc(alpha) + '</title>');
    parts.push('<desc id="adaptive-desc">Higher mean ratio and narrower interval width are preferred. Adaptive rules are shown separately from fixed confidence interval rules.</desc>');
    for(var xt=.22;xt<=.38+1e-9;xt+=.04){
      var xx=xScale(xt);
      parts.push('<line class="chart-grid" x1="'+xx+'" y1="'+top+'" x2="'+xx+'" y2="'+(H-bottom)+'"/>');
      parts.push('<text class="chart-small" x="'+xx+'" y="'+(H-29)+'" text-anchor="middle">'+xt.toFixed(2)+'</text>');
    }
    for(var yt=.80;yt<=.86+1e-9;yt+=.01){
      var yy=yScale(yt);
      parts.push('<line class="chart-grid" x1="'+left+'" y1="'+yy+'" x2="'+(W-right)+'" y2="'+yy+'"/>');
      parts.push('<text class="chart-small" x="'+(left-10)+'" y="'+(yy+4)+'" text-anchor="end">'+yt.toFixed(2)+'</text>');
    }
    parts.push('<line class="chart-axis" x1="'+left+'" y1="'+(H-bottom)+'" x2="'+(W-right)+'" y2="'+(H-bottom)+'"/>');
    parts.push('<line class="chart-axis" x1="'+left+'" y1="'+top+'" x2="'+left+'" y2="'+(H-bottom)+'"/>');
    parts.push('<text class="chart-label" x="'+((left+W-right)/2)+'" y="'+(H-7)+'" text-anchor="middle">Mean interval width → narrower is better</text>');
    parts.push('<text class="chart-label" transform="translate(18 '+((top+H-bottom)/2)+') rotate(-90)" text-anchor="middle">Mean revenue ratio → higher is better</text>');
    data.forEach(function(d,i){
      var x=xScale(d[3]),y=yScale(d[1]);
      var cls=d[5]?"chart-point-adaptive":"chart-point-fixed";
      var r=5+5*d[2];
      var anchor=x>W-180?"end":"start";
      var tx=x+(anchor==="end"?-10:10);
      var ty=y+(i%2===0?-8:14);
      parts.push('<circle class="'+cls+'" cx="'+x+'" cy="'+y+'" r="'+r.toFixed(1)+'"/>');
      parts.push('<text class="chart-small" x="'+tx+'" y="'+ty+'" text-anchor="'+anchor+'">'+esc(d[0])+'</text>');
    });
    parts.push('<circle class="chart-point-adaptive" cx="'+(W-210)+'" cy="17" r="6"/><text class="chart-small" x="'+(W-199)+'" y="20">adaptive rule</text>');
    parts.push('<circle class="chart-point-fixed" cx="'+(W-105)+'" cy="17" r="6"/><text class="chart-small" x="'+(W-94)+'" y="20">fixed CI</text>');
    svg.setAttribute("viewBox","0 0 "+W+" "+H);
    svg.innerHTML=parts.join("");
    if(note) note.textContent="α = "+alpha+" · point radius tracks feasibility rate";
    if(summary){
      var best=data[0];
      summary.innerHTML =
        '<div><span>AdaptiveFeasible mean ratio</span><strong>'+best[1].toFixed(3)+'</strong></div>'+
        '<div><span>Feasibility</span><strong>'+best[2].toFixed(3)+'</strong></div>'+
        '<div><span>Mean width</span><strong>'+best[3].toFixed(3)+'</strong></div>'+
        '<div><span>Selected CI</span><strong>'+best[4].toFixed(3)+'</strong></div>';
    }
    document.querySelectorAll("[data-adaptive-alpha]").forEach(function(b){
      b.setAttribute("aria-pressed",String(b.getAttribute("data-adaptive-alpha")===String(alpha)));
    });
  }

  document.querySelectorAll("[data-feas-alpha]").forEach(function(b){
    b.addEventListener("click",function(){renderFeasibility(b.getAttribute("data-feas-alpha"));});
  });
  document.querySelectorAll("[data-backtest-metric]").forEach(function(b){
    b.addEventListener("click",function(){renderBacktest(b.getAttribute("data-backtest-metric"));});
  });
  document.querySelectorAll("[data-adaptive-alpha]").forEach(function(b){
    b.addEventListener("click",function(){renderAdaptive(b.getAttribute("data-adaptive-alpha"));});
  });

  renderFeasibility("1");
  renderBacktest("mean");
  renderAdaptive("0");

  if ("IntersectionObserver" in window) {
    var links = Array.from(document.querySelectorAll(".robust-toc a"));
    var sections = Array.from(document.querySelectorAll(".robust-section"));
    var observer = new IntersectionObserver(function(entries){
      var visible=entries.filter(function(e){return e.isIntersecting;});
      if(!visible.length) return;
      visible.sort(function(a,b){return a.boundingClientRect.top-b.boundingClientRect.top;});
      var active="#"+visible[0].target.id;
      links.forEach(function(link){
        if(link.getAttribute("href")===active) link.setAttribute("aria-current","location");
        else link.removeAttribute("aria-current");
      });
    },{rootMargin:"-13% 0px -58% 0px",threshold:0});
    sections.forEach(function(s){observer.observe(s);});
  }
})();