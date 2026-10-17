(() => {
  const ROOT_MARKER = 'data-spider-root';
  const IGNORE_MARKER = 'data-spider-ignore';
  const normalize = value => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const MORE_BUTTON = /^(…|\.\.\.)?\s*(see |show )?more$/i;

  const GENERIC_UI_STOPWORDS = [
    'account', 'accept', 'advertisement', 'back', 'cancel', 'close', 'continue',
    'cookie', 'cookies', 'download', 'filter', 'home', 'learn', 'login', 'logout',
    'menu', 'next', 'open', 'previous', 'privacy', 'read', 'register', 'result',
    'results', 'save', 'search', 'settings', 'share', 'signin', 'signup', 'sort',
    'subscribe', 'terms', 'upload', 'view', 'website',
  ];

  const GENERIC_IGNORE_SELECTOR = [
    'nav',
    'aside',
    'footer',
    '[role="navigation"]',
    '[role="complementary"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="search"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="toolbar"]',
    '[role="tablist"]',
    '[aria-modal="true"]',
    '[aria-label*="breadcrumb" i]',
    '[aria-label*="advertisement" i]',
    '[class*="breadcrumb" i]',
    '[class*="cookie" i]',
    '[id*="cookie" i]',
    '[class*="newsletter" i]',
    '[id*="newsletter" i]',
    '[class*="sidebar" i]',
    '[id*="sidebar" i]',
    '[class*="social-share" i]',
    '[class*="share-buttons" i]',
    '[class*="advert" i]',
    '[id*="advert" i]',
  ].join(', ');

  function visibleElement(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    if (typeof element.checkVisibility === 'function' && !element.checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
    })) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function schemaTypes() {
    const types = new Set();
    const visit = value => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const currentTypes = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
      currentTypes.filter(Boolean).forEach(type => types.add(String(type).toLowerCase()));
      Object.values(value).forEach(visit);
    };
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        visit(JSON.parse(script.textContent));
      } catch {
        // Invalid structured data must not stop page extraction.
      }
    });
    return types;
  }

  function detectPageType() {
    const types = schemaTypes();
    const path = globalThis.location.pathname.toLowerCase();
    const search = globalThis.location.search.toLowerCase();
    const ogType = document.querySelector('meta[property="og:type" i]')?.content?.toLowerCase() || '';
    const hasType = (...values) => values.some(value => types.has(value));

    if (hasType('jobposting') || document.querySelector('[itemtype*="JobPosting" i]') ||
      /\b(job|jobs|career|careers)\b/.test(path)) return 'job';
    if (hasType('product', 'individualproduct', 'productgroup') ||
      document.querySelector('[itemtype*="Product" i]')) return 'product';
    if (/(^|\/)(docs?|documentation|reference|api)(\/|$)/.test(path) &&
      document.querySelector('pre, code')) return 'documentation';
    if (hasType('profilepage', 'person') || /(^|\/)(profile|people|member)(\/|$)/.test(path)) {
      return 'profile';
    }
    if (/(^|\/)(search|find)(\/|$)/.test(path) || /(^|[?&])(q|query|keyword)=/.test(search)) {
      return 'search';
    }
    const repeatedItems = document.querySelectorAll('main article, [role="main"] article');
    if (repeatedItems.length >= 4) return 'listing';
    const article = document.querySelector('article, [itemprop="articleBody"]');
    if (hasType('article', 'newsarticle', 'blogposting', 'techarticle') || ogType === 'article' ||
      (article && normalize(article.innerText).length >= 400)) return 'article';
    return 'generic';
  }

  function contentRootScore(element, pageType) {
    if (!visibleElement(element) || element.matches(GENERIC_IGNORE_SELECTOR)) return -Infinity;
    const text = normalize(element.innerText);
    if (text.length < 80) return -Infinity;
    const textLength = Math.min(text.length, 12000);
    const linkCharacters = [...element.querySelectorAll('a[href]')]
      .reduce((sum, link) => sum + normalize(link.innerText).length, 0);
    const linkDensity = Math.min(1, linkCharacters / Math.max(1, text.length));
    const headings = element.querySelectorAll('h1, h2, h3').length;
    const paragraphs = element.querySelectorAll('p, li, blockquote, pre').length;
    const controls = element.querySelectorAll('button, input, select, textarea, [role="button"]').length;
    let semanticBonus = 0;
    if (element.matches('[itemprop="articleBody"]')) semanticBonus += 1800;
    if (element.matches('article')) semanticBonus += pageType === 'listing' ? 350 : 1400;
    if (element.matches('main, [role="main"]')) semanticBonus += 700;
    if (element.matches('[class*="article" i], [class*="post-content" i], ' +
      '[class*="entry-content" i], [class~="content"]')) semanticBonus += 600;
    const densityPenalty = linkDensity * textLength * (pageType === 'listing' || pageType === 'search' ? 0.35 : 0.9);
    return textLength + semanticBonus + Math.min(headings, 12) * 90 +
      Math.min(paragraphs, 40) * 24 - densityPenalty - Math.min(controls, 30) * 18;
  }

  function findGenericContentRoot(pageType) {
    const selector = [
      '[itemprop="articleBody"]',
      'article',
      'main',
      '[role="main"]',
      '[class*="article-content" i]',
      '[class*="post-content" i]',
      '[class*="entry-content" i]',
      '[class~="content"]',
      'body > section',
      'body > div',
      'body',
    ].join(', ');
    return [...new Set(document.querySelectorAll(selector))]
      .map(element => ({ element, score: contentRootScore(element, pageType) }))
      .filter(candidate => Number.isFinite(candidate.score))
      .sort((a, b) => b.score - a.score)[0]?.element || document.body;
  }

  function pageTypeOptions(pageType, limit) {
    const stopwords = [...GENERIC_UI_STOPWORDS];
    if (pageType === 'search' || pageType === 'listing') {
      stopwords.push('showing', 'found', 'matches', 'page', 'pages');
    }
    if (pageType === 'product') {
      stopwords.push('cart', 'checkout', 'shipping', 'quantity', 'wishlist');
    }
    if (pageType === 'job') {
      stopwords.push('apply', 'applicant', 'applicants', 'promoted', 'salary', 'ago');
    }
    return {
      minScore: pageType === 'article' || pageType === 'documentation' ? 0.15 : 0.17,
      limit,
      pageType,
      stopwords,
    };
  }

  function genericAdapter() {
    const pageType = detectPageType();
    const ignoredElements = new Set();
    return {
      name: `generic-${pageType}`,
      pageType,
      async prepare() {
        for (let attempt = 0; attempt < 3 && normalize(document.body?.innerText).length < 80; attempt++) {
          await Spider.sleep(350);
        }
        document.querySelectorAll(`[${ROOT_MARKER}]`)
          .forEach(element => element.removeAttribute(ROOT_MARKER));
        const root = findGenericContentRoot(pageType);
        root.setAttribute(ROOT_MARKER, `generic-${pageType}`);
        root.querySelectorAll(GENERIC_IGNORE_SELECTOR).forEach(element => {
          if (element.hasAttribute(IGNORE_MARKER)) return;
          element.setAttribute(IGNORE_MARKER, 'generic-ui');
          ignoredElements.add(element);
        });
      },
      collect(limit) {
        const dictionary = pageType === 'job' || pageType === 'documentation'
          ? Spider.dictionaries.tech
          : null;
        return Spider.keywords(
          `[${ROOT_MARKER}="generic-${pageType}"]`,
          dictionary,
          pageTypeOptions(pageType, limit),
        );
      },
      cleanup() {
        document.querySelectorAll(`[${ROOT_MARKER}="generic-${pageType}"]`)
          .forEach(element => element.removeAttribute(ROOT_MARKER));
        ignoredElements.forEach(element => {
          if (element.getAttribute(IGNORE_MARKER) === 'generic-ui') {
            element.removeAttribute(IGNORE_MARKER);
          }
        });
      },
    };
  }

  function findLinkedInHeading() {
    return [...document.querySelectorAll('h1, h2, h3, h4, span, p, div')]
      .find(element => element.children.length === 0 && normalize(element.textContent) === 'about the job');
  }

  function locateLinkedInDescription() {
    const heading = findLinkedInHeading();
    if (!heading) return null;
    let element = heading.parentElement;
    let fallback = null;
    for (let level = 0; level < 8 && element; level++, element = element.parentElement) {
      const button = [...element.querySelectorAll('button, a[role="button"]')]
        .find(candidate => MORE_BUTTON.test(normalize(candidate.textContent)));
      if (button) return { heading, container: element, button };
      if (!fallback && (element.innerText || '').length > 400) fallback = element;
    }
    return {
      heading,
      container: fallback || heading.parentElement,
      button: null,
    };
  }

  function findLinkedInJobCards() {
    const selectors = [
      '[data-view-name*="job-card"]',
      '[data-occludable-job-id]',
      '.job-card-container',
      'li.scaffold-layout__list-item',
    ];
    for (const selector of selectors) {
      const cards = [...document.querySelectorAll(selector)]
        .filter(element => (element.innerText || '').trim().length > 40);
      if (cards.length) return cards;
    }
    return [];
  }

  function linkedInJobsAdapter() {
    return {
      name: 'linkedin-jobs',
      async prepare() {
        let description = locateLinkedInDescription();
        const expectsDetail = globalThis.location.pathname.startsWith('/jobs/view/') ||
          new URLSearchParams(globalThis.location.search).has('currentJobId');
        if (!description && expectsDetail) {
          await Spider.sleep(1500);
          description = locateLinkedInDescription();
        }
        document.querySelectorAll(`[${ROOT_MARKER}]`)
          .forEach(element => element.removeAttribute(ROOT_MARKER));
        if (!description) {
          const cards = findLinkedInJobCards();
          if (cards.length) cards.forEach(element => element.setAttribute(ROOT_MARKER, 'job-card'));
          else document.querySelector('.jobs-search-results-list, main')
            ?.setAttribute(ROOT_MARKER, 'job-list');
          return;
        }
        if (description.button) {
          description.button.click();
          await Spider.sleep(1000);
        }
        const updated = locateLinkedInDescription();
        (updated?.container || description.container).setAttribute(ROOT_MARKER, 'job-description');
      },
      collect(limit) {
        if (document.querySelector(`[${ROOT_MARKER}="job-description"]`)) {
          return Spider.keywords(
            `[${ROOT_MARKER}="job-description"]`,
            Spider.dictionaries.tech,
            { limit },
          );
        }
        if (!document.querySelector(
          `[${ROOT_MARKER}="job-card"], [${ROOT_MARKER}="job-list"]`,
        )) return [];
        return Spider.keywords(
          `[${ROOT_MARKER}="job-card"], [${ROOT_MARKER}="job-list"]`,
          Spider.dictionaries.tech,
          {
            limit,
            minScore: 0.17,
            stopwords: [
              'promoted', 'applicant', 'applicants', 'top', 'ago', 'week', 'weeks',
              'day', 'days', 'viewed', 'easy', 'apply', 'actively', 'reviewing',
              'cad', 'salary', 'year', 'years',
            ],
          },
        );
      },
      cleanup() {
        document.querySelectorAll(`[${ROOT_MARKER}]`)
          .forEach(element => element.removeAttribute(ROOT_MARKER));
      },
    };
  }

  function findLinkedInFeedRoots() {
    const selectors = [
      '[data-view-name="feed-full-update"]',
      '.feed-shared-update-v2',
      '.occludable-update',
      '[data-urn^="urn:li:activity"]',
    ];
    for (const selector of selectors) {
      const matches = [...document.querySelectorAll(selector)]
        .filter(element => (element.innerText || '').trim().length > 80);
      if (matches.length) return matches;
    }
    return [document.querySelector('.scaffold-finite-scroll__content, main[aria-label*="feed" i], main')]
      .filter(Boolean);
  }

  function linkedInFeedAdapter() {
    return {
      name: 'linkedin-feed',
      prepare() {
        document.querySelectorAll(`[${ROOT_MARKER}]`)
          .forEach(element => element.removeAttribute(ROOT_MARKER));
        findLinkedInFeedRoots().forEach(element => element.setAttribute(ROOT_MARKER, 'feed'));
      },
      collect(limit) {
        return Spider.keywords(`[${ROOT_MARKER}="feed"]`, null, {
          limit,
          minScore: 0.16,
          stopwords: [
            'feed', 'post', 'repost', 'follow', 'following', 'promoted', 'connection',
            'connections', 'reaction', 'reactions', 'comment', 'comments', 'ago',
            'like', 'celebrate', 'support', 'love', 'insightful', 'funny', 'linkedin',
          ],
        });
      },
      cleanup() {
        document.querySelectorAll(`[${ROOT_MARKER}]`)
          .forEach(element => element.removeAttribute(ROOT_MARKER));
      },
    };
  }

  function selectAdapter() {
    if (/(^|\.)linkedin\.com$/i.test(location.hostname)) {
      return location.pathname.startsWith('/jobs') ? linkedInJobsAdapter() : linkedInFeedAdapter();
    }
    return genericAdapter();
  }

  async function start(options = {}) {
    try {
      const requestedMax = Number(options.max);
      const requestedTop = Number(options.top);
      const max = Math.max(1, Math.min(500,
        Number.isFinite(requestedMax) ? Math.floor(requestedMax) : 200));
      const top = Math.max(0, Math.min(max,
        Number.isFinite(requestedTop) ? Math.floor(requestedTop) : 25));
      const timeout = Math.max(1000, Number(options.timeout) || 120000);
      const adapter = selectAdapter();
      const results = await Spider.extract(adapter, max);
      const animatedTop = Math.min(top, results.length);
      const animation = Spider.animate(timeout, animatedTop).catch(error => {
        console.error('[keyword-spider] animation failed:', error);
      });
      window.__keywordSpiderAnimation = animation;
      return {
        ok: true,
        adapter: adapter.name,
        pageType: adapter.pageType || null,
        count: results.length,
        top: animatedTop,
      };
    } catch (error) {
      console.error('[keyword-spider] start failed:', error);
      return { ok: false, error: error.message || String(error) };
    }
  }

  window.SpiderAdapters = { select: selectAdapter };
  window.SpiderExtension = { start };
})();
