let wikiArticleId = WIKI_ARTICLES[0].id;

function openWiki() {
  wikiArticleId = WIKI_ARTICLES[0].id;
  showScreen("wiki");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderWiki(app) {
  const entries = new Map(loadWikiArticles().map(article => [article.id, article]));
  const options = WIKI_GROUPS.map(group =>
    '<option value="' + uiAttr(group.id) + '">' + escapeHtml(group.title) + '</option>'
  ).join("");
  const contents = WIKI_GROUPS.map(group =>
    '<ul data-wiki-group="' + uiAttr(group.id) + '" hidden>' + group.articles.map(({ id }) =>
      '<li><button type="button" data-wiki-article="' + uiAttr(id) + '" aria-controls="wiki-article">' +
        escapeHtml(entries.get(id).title) + '</button></li>'
    ).join("") + '</ul>'
  ).join("");
  const editControls = menuMode === "developer"
    ? '<button type="button" class="btn btn-secondary" id="wiki-edit">编辑条目</button>'
    : '';
  app.innerHTML = '<main class="screen active wiki-screen">' + pageHeader("RRWIKI", "wiki-back") +
    '<div class="wiki-layout"><nav class="wiki-contents" aria-labelledby="wiki-contents-title">' +
      '<label class="wiki-contents-title" id="wiki-contents-title" for="wiki-category">条目目录</label>' +
      '<select id="wiki-category" aria-controls="wiki-directory">' + options + '</select>' +
      '<div class="wiki-directory" id="wiki-directory">' + contents + '</div></nav>' +
    '<article class="wiki-article" id="wiki-article" aria-labelledby="wiki-article-title">' +
      '<div class="wiki-article-header"><h1 id="wiki-article-title" tabindex="-1"></h1>' + editControls + '</div>' +
      '<p id="wiki-save-status" role="status"></p><p class="wiki-summary"></p><div class="wiki-body"></div>' +
      '<button type="button" class="btn btn-secondary wiki-to-contents">返回目录</button></article></div></main>';

  const list = app.querySelector(".wiki-contents");
  const category = list.querySelector("#wiki-category");
  const directory = list.querySelector("#wiki-directory");
  const directories = [...directory.querySelectorAll("[data-wiki-group]")];
  const article = app.querySelector("#wiki-article");
  const heading = article.querySelector("h1");
  const summary = article.querySelector(".wiki-summary");
  const body = article.querySelector(".wiki-body");
  const feedback = article.querySelector("#wiki-save-status");
  const buttons = new Map([...directory.querySelectorAll("[data-wiki-article]")].map(button => [button.dataset.wikiArticle, button]));

  function showArticle(entry, moveFocus) {
    wikiArticleId = entry.id;
    const selectedButton = buttons.get(entry.id);
    const activeDirectory = selectedButton.closest("[data-wiki-group]");
    directory.querySelector('[aria-current="true"]')?.removeAttribute("aria-current");
    selectedButton.setAttribute("aria-current", "true");
    if (activeDirectory.hidden) {
      category.value = activeDirectory.dataset.wikiGroup;
      directories.forEach(group => { group.hidden = group !== activeDirectory; });
      directory.scrollTop = 0;
    }
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

  category.addEventListener("change", () => {
    const group = WIKI_GROUPS.find(group => group.id === category.value);
    showArticle(entries.get(group.articles[0].id), false);
    heading.scrollIntoView({ block: "nearest", behavior: "instant" });
  });
  buttons.forEach((button, id) => {
    button.addEventListener("click", () => showArticle(entries.get(id), true));
  });
  article.querySelector(".wiki-to-contents").addEventListener("click", () => {
    buttons.get(wikiArticleId).focus();
  });
  article.querySelector("#wiki-edit")?.addEventListener("click", () => {
    openWikiEditor(entries.get(wikiArticleId), saved => {
      entries.set(saved.id, saved);
      buttons.get(saved.id).textContent = saved.title;
      showArticle(saved, false);
      feedback.textContent = "已保存到当前浏览器。";
    });
  });
  app.querySelector("#wiki-back").addEventListener("click", leaveWiki);
  app.querySelector(".wiki-screen").addEventListener("keydown", event => {
    if (event.key === "Escape" && !event.defaultPrevented && event.target !== category) {
      event.preventDefault();
      leaveWiki();
    }
  });
  showArticle(entries.get(wikiArticleId) || entries.get(WIKI_ARTICLES[0].id), false);
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
