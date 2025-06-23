class DatabaseManager {
    constructor() {
        this.db = null;
        this.SQL = null;
        this.isInitialized = false;
        this.initPromise = this.init();
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // SQL.jsの初期化
            console.log('SQL.jsの初期化を開始...');
            this.SQL = await window.initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });
            console.log('SQL.jsの初期化が完了しました。');

            // IndexedDBからデータベースを読み込む
            console.log('IndexedDBからのデータベース読み込みを開始...');
            const dbData = await this.loadFromIndexedDB();
            
            if (dbData) {
                console.log('既存のデータベースを読み込みました。');
                this.db = new this.SQL.Database(dbData);
            } else {
                console.log('新しいデータベースを作成します。');
                this.db = new this.SQL.Database();
                await this.createTables();
                await this.saveToIndexedDB();
            }

            this.isInitialized = true;
            console.log('データベースが正常に初期化されました。');
        } catch (error) {
            console.error('データベース初期化エラーの詳細:', error);
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                window.showError(
                    'ストレージ容量が不足しています。',
                    error.stack,
                    '不要なデータやキャッシュを削除してから再度お試しください。\n\n\
ストレージ使用量は「データベース管理」欄で確認できます。\n\
「データベースをクリア」ボタンで全データを削除できます。\n\
容量の目安: ブラウザごとに異なりますが、通常50MB〜2GB程度です。'
                );
            } else if (error instanceof DOMException && error.name === 'SecurityError') {
                window.showError(
                    'セキュリティの制限によりデータベースにアクセスできません。',
                    error.stack,
                    'ブラウザの設定やプライベートモードを確認してください。'
                );
            } else if (error.message && error.message.includes('Failed to fetch')) {
                window.showError(
                    'ネットワークエラーが発生しました。',
                    error.stack,
                    'インターネット接続を確認してください。'
                );
            } else {
                window.showError(
                    'データベースの初期化に失敗しました。',
                    error.stack,
                    'ページを再読み込みしても解決しない場合は管理者にご連絡ください。'
                );
            }
            throw new Error(error.message);
        }
    }

    async createTables() {
        try {
            console.log('テーブルの作成を開始...');
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS books (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    isbn TEXT,
                    title TEXT NOT NULL,
                    author TEXT NOT NULL,
                    publisher TEXT,
                    genre TEXT,
                    status TEXT DEFAULT 'unread',
                    memo TEXT,
                    added_date DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `;
            this.db.run(createTableSQL);
            await this.saveToIndexedDB();
            console.log('テーブルが正常に作成されました。');
        } catch (error) {
            console.error('テーブル作成エラーの詳細:', error);
            throw new Error(`テーブルの作成に失敗しました: ${error.message}`);
        }
    }

    async saveToIndexedDB() {
        try {
            console.log('データベースの保存を開始...');
            const data = this.db.export();
            const db = await this.openIndexedDB();
            const tx = db.transaction('databases', 'readwrite');
            const store = tx.objectStore('databases');
            await store.put(data, 'books');
            await tx.complete;
            console.log('データベースを保存しました。');
        } catch (error) {
            console.error('データベース保存エラーの詳細:', error);
            throw new Error(`データベースの保存に失敗しました: ${error.message}`);
        }
    }

    async loadFromIndexedDB() {
        try {
            console.log('IndexedDBからのデータベース読み込みを開始...');
            const db = await this.openIndexedDB();
            const tx = db.transaction('databases', 'readonly');
            const store = tx.objectStore('databases');
            const data = await store.get('books');
            console.log('IndexedDBからのデータベース読み込みが完了しました。');
            return data;
        } catch (error) {
            console.error('データベース読み込みエラーの詳細:', error);
            return null;
        }
    }

    openIndexedDB() {
        return new Promise((resolve, reject) => {
            console.log('IndexedDBを開いています...');
            const request = indexedDB.open('BookManager', 1);

            request.onerror = (event) => {
                console.error('IndexedDBを開く際にエラーが発生しました:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                console.log('IndexedDBを開きました。');
                resolve(event.target.result);
            };

            request.onupgradeneeded = (event) => {
                console.log('IndexedDBのアップグレードが必要です...');
                const db = event.target.result;
                if (!db.objectStoreNames.contains('databases')) {
                    db.createObjectStore('databases');
                    console.log('データストアを作成しました。');
                }
            };
        });
    }

    async addBook(book) {
        try {
            await this.initPromise;
            // booksテーブルがなければ自動作成
            const tableCheck = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='books'");
            if (!tableCheck || tableCheck.length === 0 || tableCheck[0].values.length === 0) {
                await this.createTables();
            }
            const stmt = this.db.prepare(`
                INSERT INTO books (isbn, title, author, publisher, genre, status, memo)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run([
                book.isbn,
                book.title,
                book.author,
                book.publisher,
                book.genre,
                book.status,
                book.memo
            ]);
            stmt.free();
            await this.saveToIndexedDB();
            return true;
        } catch (error) {
            console.error('本の追加エラー:', error);
            throw error;
        }
    }

    async deleteBook(id) {
        try {
            const deleteSQL = 'DELETE FROM books WHERE id = ?';
            this.db.run(deleteSQL, [id]);
            await this.saveToIndexedDB();
            return true;
        } catch (error) {
            console.error('本の削除エラー:', error);
            throw error;
        }
    }

    async getAllBooks() {
        try {
            // booksテーブルがなければ自動作成
            const tableCheck = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='books'");
            if (!tableCheck || tableCheck.length === 0 || tableCheck[0].values.length === 0) {
                await this.createTables();
            }
            const selectSQL = 'SELECT * FROM books ORDER BY added_date DESC';
            const results = this.db.exec(selectSQL);
            
            if (results && results.length > 0) {
                return results[0].values.map(row => ({
                    id: row[0],
                    isbn: row[1],
                    title: row[2],
                    author: row[3],
                    publisher: row[4],
                    genre: row[5],
                    status: row[6],
                    memo: row[7],
                    addedDate: row[8]
                }));
            }
            return [];
        } catch (error) {
            console.error('本の取得エラー:', error);
            throw error;
        }
    }

    async searchBooks(query) {
        try {
            // booksテーブルがなければ自動作成
            const tableCheck = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='books'");
            if (!tableCheck || tableCheck.length === 0 || tableCheck[0].values.length === 0) {
                await this.createTables();
            }
            const searchSQL = `
                SELECT * FROM books 
                WHERE title LIKE ? 
                OR author LIKE ? 
                OR publisher LIKE ? 
                OR genre LIKE ?
                ORDER BY added_date DESC
            `;
            
            const searchPattern = `%${query}%`;
            const results = this.db.exec(searchSQL, [searchPattern, searchPattern, searchPattern, searchPattern]);
            
            if (results && results.length > 0) {
                return results[0].values.map(row => ({
                    id: row[0],
                    isbn: row[1],
                    title: row[2],
                    author: row[3],
                    publisher: row[4],
                    genre: row[5],
                    status: row[6],
                    memo: row[7],
                    addedDate: row[8]
                }));
            }
            return [];
        } catch (error) {
            console.error('本の検索エラー:', error);
            throw error;
        }
    }

    async getTotalBooks() {
        try {
            // booksテーブルがなければ自動作成
            const tableCheck = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='books'");
            if (!tableCheck || tableCheck.length === 0 || tableCheck[0].values.length === 0) {
                await this.createTables();
            }
            const countSQL = 'SELECT COUNT(*) as count FROM books';
            const results = this.db.exec(countSQL);
            return results && results.length > 0 ? results[0].values[0][0] : 0;
        } catch (error) {
            console.error('本の総数取得エラー:', error);
            throw error;
        }
    }
}

// グローバルなデータベースマネージャーインスタンスを作成
window.dbManager = new DatabaseManager();

// エラー表示用関数
window.showError = function(message, details = '', guidance = '') {
    const old = document.getElementById('customErrorBox');
    if (old) old.remove();
    const div = document.createElement('div');
    div.id = 'customErrorBox';
    div.style = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#fee2e2;color:#b91c1c;padding:16px;border-bottom:2px solid #f87171;';
    div.innerHTML = `
        <strong>エラー:</strong> ${message}<br>
        ${guidance ? `<div style="margin-top:8px;">${guidance}</div>` : ''}
        ${details ? `<button id="showDetailsBtn" style="margin-top:8px;">詳細を表示</button>
        <pre id="errorDetails" style="display:none;background:#fff0f0;color:#b91c1c;padding:8px;border-radius:4px;">${details}</pre>` : ''}
        <button id="closeErrorBtn" style="float:right;">閉じる</button>
    `;
    document.body.appendChild(div);
    if (details) {
        document.getElementById('showDetailsBtn').onclick = () => {
            const pre = document.getElementById('errorDetails');
            pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
        };
    }
    document.getElementById('closeErrorBtn').onclick = () => div.remove();
}; 