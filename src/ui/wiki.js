let wikiArticle = WIKI_ARTICLES[0];

function openWiki() {
  wikiArticle = WIKI_ARTICLES[0];
  showScreen("wiki");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderWiki(app) {
  const contents = WIKI_ARTICLES.map(article =>
    '<li><button type="button" data-wiki-article="' + uiAttr(article.id) + '" aria-controls="wiki-article">' + escapeHtml(article.title) + '</button></li>'
  ).join("");
  app.innerHTML = '<main class="screen active wiki-screen">' + pageHeader("RRWIKI", "wiki-back") +
    '<div class="wiki-layout"><nav class="wiki-contents" aria-labelledby="wiki-contents-title">' +
      '<p class="wiki-contents-title" id="wiki-contents-title">条目目录</p><ul>' + contents + '</ul></nav>' +
    '<article class="wiki-article" id="wiki-article" aria-labelledby="wiki-article-title"></article></div></main>';

  const list = app.querySelector(".wiki-contents");
  const article = app.querySelector("#wiki-article");
  const buttons = [...list.querySelectorAll("[data-wiki-article]")];

  function showArticle(entry, moveFocus) {
    wikiArticle = entry;
    buttons.forEach(button => {
      if (button.dataset.wikiArticle === entry.id) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    const sections = entry.sections.map(section =>
      '<section><h2>' + escapeHtml(section.title) + '</h2>' +
      section.paragraphs.map(paragraph => '<p>' + escapeHtml(paragraph) + '</p>').join("") + '</section>'
    ).join("");
    article.innerHTML = '<h1 id="wiki-article-title" tabindex="-1">' + escapeHtml(entry.title) + '</h1>' +
      '<p class="wiki-summary">' + escapeHtml(entry.summary) + '</p>' + sections +
      '<button type="button" class="btn btn-secondary wiki-to-contents">返回目录</button>';
    article.querySelector(".wiki-to-contents").addEventListener("click", () => {
      list.querySelector('[aria-current="true"]').focus();
    });
    if (moveFocus) article.querySelector("h1").focus();
  }

  function leaveWiki() {
    showScreen("menu");
    app.querySelector("#btn-wiki").focus();
  }

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => showArticle(WIKI_ARTICLES[index], true));
  });
  app.querySelector("#wiki-back").addEventListener("click", leaveWiki);
  app.querySelector(".wiki-screen").addEventListener("keydown", event => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      leaveWiki();
    }
  });
  showArticle(wikiArticle, false);
}
