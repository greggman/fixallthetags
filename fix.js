const $ = document.querySelector.bind(document);
let g = {
  expirationDate: null,
  accessToken: null,
  site: 'stackoverflow',
  baseUrl: 'https://api.stackexchange.com/2.2',
  channelUrl: makeLocalUrl('blank.html'),
  loginResults: $('#login-area .results'),
  searchResults: $('#search-area .results'),
  clientId: 10511,
  key: 'yOk9EKF1oHV)qVIkp5PKnA((',
  removeTags: [],
  addTags: [],
};

const useMock = window.location.hostname === 'localhost';
if (useMock) {
  $('#login-area .results').textContent = 'using mock stack exchange api';
}
loadScript(useMock
    ? 'mock-se.js'
    : 'https://api.stackexchange.com/js/2.0/all.js',
  init);

function loadScript(url, callback) {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.charst = 'utf-8';
  script.async = true;
  script.addEventListener('load', callback);
  script.src = url;
  document.body.appendChild(script);
}

function init() {
  SE.init({
      clientId: g.clientId,
      key: g.key,
      channelUrl: g.channelUrl,
      complete: (data) => {
        // { version: 'some-unique-string' }
        $('#init-area').style.display = 'none';
        $('#login-area').style.display = 'block';
      },
  });
}

function authenticate() {
  $('#login').disabled = true;
  SE.authenticate({
      success: (data) => {
        // { accessToken: '12345',
        //   expirationDate: new Date(...),
        //   networkUsers: [...] }
        console.log(data);
        g.accessToken = data.accessToken;
        g.expirationDate = data.expirationDate;
        g.loginResults.style.color = '';
        $('#login-area').style.display = 'none';
        $('#search-area').style.display = 'block';
      },
      error: (data) => {
        // { errorName: 'access_denied',
        // errorMessage: 'the unicorns are not amused' }
        g.loginResults.style.color = 'red';
        g.loginResults.textContent = `${data.errorName}: ${data.errorMessage}`;
        $('#login').disabled = false;
      },
      scope: ['write_access'],
      networkUsers: false,
  });
}

function search() {
  const tags = parseTags($('#search').value)
  const params = {
    order: 'desc',
    sort: 'activity',
    tagged: tags.join(';'),
    filter: '8G3NhCJa', // unsafe=true + question.body_markdown
  };
  seRequest('GET', '/questions', params, '', (error, data) => {
    if (error) {
      g.searchResults.style.color = 'red';
      g.searchResults.innerHTML = '';
      g.searchResults.textContent = JSON.stringify(error);
      return;
    } else {
      g.searchResults.style.color = '';
      g.searchResults.innerHTML = '';
      $('#fix-area').style.display = 'block';
      console.log(data);
      g.questions = data.items.map(q => {
        const questionElem = createElement('div', 'question');
        const titleElem = createElement('a', 'title', questionElem, q.title);
        titleElem.href = q.link;
        const userElem = createElement('a', 'user', questionElem, q.owner.display_name);
        userElem.href = q.owner.link;
        const imageElem = createElement('img', 'avatar', questionElem);
        imageElem.src = q.owner.profile_image;
        imageElem.onerror = useMissingImage;
        const tagsElem = createElement('div', 'tags', questionElem);
        q.tags.forEach(tag => {
          createElement('div', 'tag', tagsElem, tag);
        });
        const newTagsElem = createElement('div', 'new-tags', questionElem);
        const buttonElem = createElement('button', 'fix', questionElem, 'fix');
        const info = {
          buttonElem: buttonElem,
          newTagsElem: newTagsElem,
          tags: q.tags,
          question: q,
          questionElem: questionElem,
          buttonElem: buttonElem,
        };
        buttonElem.addEventListener('click', (e) => {
          fixTags(info);
        });
        g.searchResults.appendChild(questionElem);
        return info;
      });

      updateNewTags();
    }
  });
}

function updateNewTags() {
  g.questions.forEach((info) => {
    const newTags = info.tags.filter(tag => g.removeTags.indexOf(tag) < 0);
    g.addTags.forEach(tag => {
      if (newTags.indexOf(tag) < 0) {
        newTags.push(tag);
      }
    });
    info.newTags = newTags;
    info.newTagsElem.innerHTML = '';
    newTags.forEach(tag => {
      createElement('div', 'tag', info.newTagsElem, tag);
    });
  });
}


function addTags() {
  g.addTags = parseTags($('#add').value);
  updateNewTags();
}

function removeTags() {
  g.removeTags = parseTags($('#remove').value);
  updateNewTags();
}

function fixTags(info) {
  info.questionElem.disabled = true;
  info.buttonElem.disabled = true;
  const q = info.question;
  const id = q.question_id;
  const params = {
    tags: info.newTags.join(';'),
    title: q.title,
    body: q.body_markdown,
//    preview: true,
    comment: 'edited tags',
  };
  seRequest('POST', `/questions/${id}/edit`, params, '', (error, data) => {
    console.log('ERROR:', error);
    console.log('DATA:', data);
  });
}

function parseTags(s) {
  return s.trim().split(/[\n\r\t ;,]+/);
}

function useMissingImage(e) {
  e.target.src = 'missing-or-blocked.png';
}

function createElement(type, className, parent, textContent) {
  const elem = document.createElement(type);
  if (textContent) {
    elem.textContent = textContent;
  }
  if (className) {
    elem.className = className;
  }
  if (parent) {
    parent.appendChild(elem);
  }
  return elem;
}

function seRequest(method, path, params, data, callback) {
  let queryString = '';
  let sendArg;
  const query = Object.assign({}, params, {
    access_token: g.accessToken,
    key: g.key,
    site: g.site,
  });
  if (method.toUpperCase() === 'GET') {
    queryString = '?' + paramsToString(query);
    sendArg = data || '';
  } else {
    const fd = new FormData();
    Object.keys(query).forEach(key => {
      fd.append(key, query[key]);
    });
    sendArg = fd;
  }
  const url = `${g.baseUrl}${path}${queryString}`;
  xhr(method, url, sendArg, (error, data) => {
    if (error || data.error_id || data.error_message || data.error_name) {
      callback(error || data);
    } else {
      callback(null, data);
    }
  });
}

function paramsToString(params) {
  return Object.keys(params).map((key) => {
    return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
  }).join('&');
}

function xhr(method, url, data, callback) {
  const request = new XMLHttpRequest();
  request.addEventListener('load', () => {
    let error = undefined;
    let data = undefined;
    try {
      data = JSON.parse(request.response);
    } catch (e) {
      error = e;
    }
    callback(error, data);
  });
  request.addEventListener('error', (e) => {
    callback(e);
  });
  request.open(method, url);
  request.send(data || '');
}


function makeLocalUrl(path) {
  const a = document.createElement('a');
  a.href = path;
  return a.href;
}

$('#login').addEventListener('click', authenticate);
$('#search').addEventListener('change', search);
$('#add').addEventListener('change', addTags);
$('#remove').addEventListener('change', removeTags);

