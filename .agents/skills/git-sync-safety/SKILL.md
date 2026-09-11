---
name: git-sync-safety
description: 石川マップで作業を始める前、コミット前、またはプッシュ前に、作業ツリーとGitHubとの差を確認し、安全な同期方法を判断する。fetch・pull・競合解消・pushを伴うGit同期に使用する。通常のGit履歴閲覧だけには使用しない。
---

# Git同期の安全確認

石川マップはGitHub Actionsによるニュース更新や店舗主依頼処理でも`main`が更新される。ローカルが最新だと仮定せず、作業開始前、コミット前、プッシュ前に同期状態を確認する。

## 必須原則

- 既存の未コミット変更、未追跡ファイル、別作業ツリーを勝手に消さない。
- `git pull`より先に`git status`と`git fetch`を行い、ahead／behindを確認する。
- `git reset --hard`、強制push、履歴の上書きは、通常の同期手段として使わない。
- fetchはリモート追跡情報の更新であり、作業ファイルの同期ではない。pull、merge、rebase、pushと区別して説明する。
- pull、merge、rebase、競合解消、pushは、それぞれユーザーの依頼範囲と外部変更への影響を確認してから行う。
- 自動更新されたニュースデータや店舗主依頼履歴は、古いローカル版で上書きしない。

## 状態確認

プロジェクトルートで次を実行する。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check_git_sync.ps1 -Fetch
```

スクリプトはファイルを変更せず、次を報告する。

- 現在のブランチとupstream
- tracked・untrackedの作業ツリー変更
- upstreamに対するahead／behind件数
- 通常同期、fast-forward、push候補、分岐対応のどれに該当するか

ネットワークアクセスやfetchが依頼範囲外の場合は`-Fetch`を付けず、現在取得済みのupstream情報だけを確認する。

## 結果ごとの判断

### ahead 0 / behind 0

同期済み。未コミット変更があれば保護したまま、依頼された作業だけを進める。

### ahead 0 / behind 1以上

- 作業ツリーが完全にクリーンなら、ユーザーの意図を確認してfast-forwardのみのpullを使う。
- 未コミット変更があれば、勝手にstashやpullをせず、対象と退避方法を提示する。

```powershell
git pull --ff-only
```

### ahead 1以上 / behind 0

ローカルコミットだけが先行している。コミット内容とテスト結果を確認し、明示的に依頼された場合だけpushする。

### ahead 1以上 / behind 1以上

枝分かれ状態。単純なpullやpushを行わない。

1. 共通祖先と双方のコミットを確認する。
2. 同じファイルを変更している範囲を確認する。
3. バックアップブランチと未コミット変更の保護方法を提示する。
4. 競合解消を伴う統合について、リスクと対象を説明してユーザーの明示的な許可を得る。
5. 自動生成データは新しいGitHub側を優先し、ローカル固有のコード・決定記録は意味を比較して統合する。
6. 統合後にプロジェクト固有の検査、ローカル表示、`git diff --check`を実行する。
7. ユーザーがpushを依頼している場合だけpushし、GitHub Pagesの完了まで確認する。

#### 報告

件数だけでなく、次を短く区別して伝える。

- ローカルの未コミット変更
- ローカルだけのコミット
- GitHubだけのコミット
- 実施した操作（fetch／pull／merge／push）
- 未実施または承認待ちの操作

「fetch済み」を「同期完了」と表現しない。ローカルとupstreamが一致し、必要なpushも成功した時点で同期完了とする。
