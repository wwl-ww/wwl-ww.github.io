/** Central UI state; window accessors preserve existing inline-handler integrations. */
window.Reader = window.Reader || {};
Reader.state = {
    flatChapters: [],
    currentChapterId: null,
    currentChapterPath: null,
    currentChapterTitle: null,
    currentChapterNumber: null,
    pendingChapter: null,
    chapterMap: {},
    totalWordCount: 0,
    searchTimer: null,
    treeData: null,
    currentUser: null,
    sessionToken: Reader.storage.getItem('reader_session_token') || null
};
Object.keys(Reader.state).forEach(function(key) {
    Object.defineProperty(window, key, {
        configurable: true,
        get: function() { return Reader.state[key]; },
        set: function(value) { Reader.state[key] = value; }
    });
});
