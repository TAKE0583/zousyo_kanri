# zousyo_kanri

## 変更履歴

- 2025-06-23
    - DatabaseManagerクラスの定義をdatabase.jsに一元化。
    - index.htmlからDatabaseManagerの重複定義とインスタンス生成を削除し、window.dbManagerを利用する形に修正。
    - register.html, list.htmlは既にwindow.dbManager利用で統一されていることを確認。
- 2025-06-23
    - エラーハンドリングを強化。showError関数をdatabase.jsに追加し、catch句でユーザーへの詳細なガイダンスとエラー詳細表示を行うように修正。
- 2025-06-23
    - IndexedDBストレージ使用量の表示機能をindex.htmlに追加。容量が80%以上で警告を表示。
    - クォータ超過エラー時のガイダンスを強化し、ストレージ容量の目安やデータ削除の提案をshowErrorで案内するように修正。
- 2025-06-23
    - register.htmlのISBN/JANコード欄を数字のみ入力可能に変更。type="number"、inputmode、pattern属性を追加し、JavaScriptでも非数値入力を防止。
- 2025-06-23
    - booksテーブルが存在しない場合、addBook時に自動でテーブルを作成するよう修正。
- 2025-06-23
    - getAllBooks, getTotalBooks, searchBooksでもbooksテーブルがなければ自動作成するよう修正。
- 2025-06-23
    - database.jsのinit()で新規作成時、必ずsaveToIndexedDBを呼ぶよう修正し、ページ間でDBが共有されない問題を根本的に防止。
- 2025-06-23
    - init()でloadFromIndexedDBの返り値が本当に有効なデータか厳密に判定し、空バッファや0バイトも"データなし"とみなすよう修正。
