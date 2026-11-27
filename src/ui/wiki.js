let wikiArticleId = WIKI_ARTICLES[0].id;

function openWiki() {
  wikiArticleId = WIKI_ARTICLES[0].id;
  showScreen("wiki");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderWiki(app) {
  const entries = loadWikiArticles();
  const contents = entries.map(article =>
    '<li><button type="button" data-wiki-article="' + uiAttr(article.id) + '" aria-controls="wiki-article">' + escapeHtml(article.title) + '</button></li>'
  ).join("");
  const editControls = menuMode === "developer"
    ? '<button type="button" class="btn btn-secondary" id="wiki-edit">编辑条目</button>'
    : '';
  app.innerHTML = '<main class="screen active wiki-screen">' + pageHeader("RRWIKI", "wiki-back") +
    '<div class="wiki-layout"><nav class="wiki-contents" aria-labelledby="wiki-contents-title">' +
      '<p class="wiki-contents-title" id="wiki-contents-title">条目目录</p><ul>' + contents + '</ul></nav>' +
    '<article class="wiki-article" id="wiki-article" aria-labelledby="wiki-article-title">' +
      '<div class="wiki-article-header"><h1 id="wiki-article-title" tabindex="-1"></h1>' + editControls + '</div>' +
      '<p id="wiki-save-status" role="status"></p><p class="wiki-summary"></p><div class="wiki-body"></div>' +
      '<button type="button" class="btn btn-secondary wiki-to-contents">返回目录</button></article></div></main>';

  const list = app.querySelector(".wiki-contents");
  const article = app.querySelector("#wiki-article");
  const heading = article.querySelector("h1");
  const summary = article.querySelector(".wiki-summary");
  const body = article.querySelector(".wiki-body");
  const feedback = article.querySelector("#wiki-save-status");
  const buttons = [...list.querySelectorAll("[data-wiki-article]")];

  function showArticle(entry, moveFocus) {
    wikiArticleId = entry.id;
    buttons.forEach(button => {
      if (button.dataset.wikiArticle === entry.id) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    heading.textContent = entry.title;
    summary.textContent = entry.summary;
    body.innerHTML = entry.sections.map(section =>
      '<section><h2>' + escapeHtml(section.title) + '</h2>' +
      section.paragraphs.map(paragraph => '<p>' + escapeHtml(paragraph) + '</p>').join("") + '</section>'
    ).join("");
    feedback.textContent = "";
    if (moveFocus) heading.focus();
  }

  function leaveWiki() {
    showScreen("menu");
    app.querySelector("#btn-wiki").focus();
  }

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => showArticle(entries[index], true));
  });
  article.querySelector(".wiki-to-contents").addEventListener("click", () => {
    list.querySelector('[aria-current="true"]').focus();
  });
  article.querySelector("#wiki-edit")?.addEventListener("click", () => {
    const index = entries.findIndex(entry => entry.id === wikiArticleId);
    openWikiEditor(entries[index], saved => {
      entries[index] = saved;
      buttons[index].textContent = saved.title;
      showArticle(saved, false);
      feedback.textContent = "已保存到当前浏览器。";
    });
  });
  app.querySelector("#wiki-back").addEventListener("click", leaveWiki);
  app.querySelector(".wiki-screen").addEventListener("keydown", event => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      leaveWiki();
    }
  });
  showArticle(entries.find(entry => entry.id === wikiArticleId) || entries[0], false);
}

function openWikiEditor(entry, onSave) {
  if (menuMode !== "developer" || gameState.screen !== "wiki") return;
  removeBodyLayer("modal-overlay");
  document.body.insertAdjacentHTML("beforeend", '<div class="modal-overlay show" id="modal-overlay">' +
    '<form class="modal wiki-editor-dialog" id="wiki-editor" novalidate><h3>编辑条目</h3>' +
    '<div class="wiki-editor-fields">' +
    '<p class="wiki-editor-note">小节正文用空行分段。修改保存在当前浏览器。</p>' +
    '<div class="form-group"><label for="wiki-edit-title">条目标题</label><input id="wiki-edit-title" required></div>' +
    '<div class="form-group"><label for="wiki-edit-summary">摘要</label><textarea id="wiki-edit-summary" rows="2" required></textarea></div>' +
    '<div id="wiki-edit-sections"></div><button type="button" class="btn btn-secondary" id="wiki-add-section">添加小节</button></div>' +
    '<p id="wiki-edit-error" role="alert"></p><div class="form-actions">' +
      '<button type="button" class="btn btn-secondary" id="form-cancel">取消</button>' +
      '<button type="submit" class="btn btn-primary" id="form-save">保存</button></div></form></div>');
  const layer = prepareFormLayer();
  const form = layer.querySelector("#wiki-editor");
  const title = form.querySelector("#wiki-edit-title");
  const summary = form.querySelector("#wiki-edit-summary");
  const sections = form.querySelector("#wiki-edit-sections");
  const addButton = form.querySelector("#wiki-add-section");
  const error = form.querySelector("#wiki-edit-error");
  let fieldNumber = 0;
  title.value = entry.title;
  summary.value = entry.summary;

  function numberSections() {
    const fields = [...sections.children];
    fields.forEach((field, index) => {
      const name = "小节 " + (index + 1);
      field.querySelector("legend").textContent = name;
      const remove = field.querySelector("[data-wiki-remove-section]");
      remove.setAttribute("aria-label", "删除" + name);
      remove.disabled = fields.length === 1;
    });
  }

  function addSection(section) {
    const prefix = "wiki-section-" + ++fieldNumber;
    const field = document.createElement("fieldset");
    field.className = "wiki-edit-section";
    field.innerHTML = '<legend></legend>' +
      '<div class="form-group"><label for="' + prefix + '-title">小节标题</label>' +
        '<input id="' + prefix + '-title" data-wiki-section-title required></div>' +
      '<div class="form-group"><label for="' + prefix + '-body">正文</label>' +
        '<textarea id="' + prefix + '-body" rows="4" data-wiki-section-body required></textarea></div>' +
      '<button type="button" class="btn btn-secondary" data-wiki-remove-section>删除小节</button>';
    const fieldTitle = field.querySelector("[data-wiki-section-title]");
    fieldTitle.value = section.title;
    field.querySelector("[data-wiki-section-body]").value = section.paragraphs.join("\n\n");
    field.querySelector("[data-wiki-remove-section]").addEventListener("click", () => {
      const next = field.nextElementSibling || field.previousElementSibling;
      if (!next) return;
      field.remove();
      numberSections();
      next.querySelector("[data-wiki-section-title]").focus();
    });
    sections.appendChild(field);
    return fieldTitle;
  }

  entry.sections.forEach(addSection);
  numberSections();
  addButton.addEventListener("click", () => {
    const field = addSection({ title: "", paragraphs: [] });
    numberSections();
    field.focus();
  });
  form.querySelector("#form-cancel").addEventListener("click", closeModal);
  form.addEventListener("input", event => {
    event.target.removeAttribute("aria-invalid");
    error.textContent = "";
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!layer.layerIsOpen() || menuMode !== "developer") return;
    const empty = [...form.querySelectorAll("[required]")].find(field => !field.value.trim());
    if (empty) {
      empty.setAttribute("aria-invalid", "true");
      error.textContent = "请填写标出的字段。";
      empty.focus();
      return;
    }
    const sectionsToSave = [...sections.children].map(field => ({
      title: field.querySelector("[data-wiki-section-title]").value,
      paragraphs: field.querySelector("[data-wiki-section-body]").value.split(/\n(?:[^\S\n]*\n)+/).filter(text => text.trim())
    }));
    let saved;
    try {
      saved = saveWikiArticle({ id: entry.id, title: title.value, summary: summary.value, sections: sectionsToSave });
    } catch (failure) {
      error.textContent = failure.message;
      return;
    }
    onSave(saved);
    closeModal();
  });
}
