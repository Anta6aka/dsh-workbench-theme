# Project Zones Spec

Status: data layer + `/project/items` API implemented; note bridge writes project items; six-zone UI pending.

## 目标

给当前工作区一套可持久化的工作管理模型，六区只是视图，状态是列，不复制状态。

便签收件箱是上游捕获层，不替代项目六区。

## 非目标

- 不做第七个“进行中”目录；
- 不做六个独立文件夹，每区存一份文件；
- 不让便签直接推进到 `active`，必须经过项目区；
- 不强制多 agent 协作；单人项目可以自检。

## 数据模型

单一源：`pet-data/project-zones.json`（本地，不提交）。

```json
{
  "items": [
    {
      "id": "pz-...",
      "kind": "material | idea | task",
      "title": "...",
      "body": "...",
      "status": "idea | backlog | active | waiting | paused | acceptance | archived",
      "role": "main | parallel | observation",
      "priority": 0,
      "source": "note | user | agent",
      "sourceNoteId": "...",
      "createdAt": 0,
      "updatedAt": 0
    }
  ]
}
```

同一事项只改 `status`，不复制记录。

## 六区视图

| 视图 | 过滤 |
| --- | --- |
| 资料库 | `kind=material` |
| 想法库 | `kind=idea` 且 `status=idea` |
| 待办 | `status=backlog`，槽满时标 `queued` |
| 当前档期 | `status=active/waiting/paused` |
| 公共验收区 | `status=acceptance` |
| 历史归档 | `status=archived` |

`queued` 是待办内的标记，不是第七区。

## 槽位

- 每个执行者默认 1 个主批次（`role=main`）；
- 最多 1 个并行/观察项；
- 槽满的新任务留待办标 `queued`；
- 当前档期只显示占用注意力的项目，不显示全部计划。

## 便签到想法库协议

便签动作只允许：

1. 留想法：不变；
2. 进待办：复制短卡，`promoted=true`；
3. 现在做：复制完整任务卡，`promoted=true`。

后续实现真实写入时：

```http
POST /project/items
{ "kind": "idea", "title": "...", "body": "...", "source": "note", "sourceNoteId": "..." }
```

服务端创建 `status=idea`，便签只标记已转出。便签永远不直接创建 `active`。

## 视图与文件

MVP 以 JSON 为唯一源。Markdown 视图如果要生成，只能从 JSON 生成，不能手改两份。

验收区记录：

- 验收标准；
- 证据入口；
- 未验证项；
- 回滚点。

单人项目自检即可，不要求双 agent。

## 实施阶段

1. 数据层：JSON 读写、CRUD、槽位校验；
2. API：`/project/items`、`/project/snapshot`；
3. UI：侧栏工作台六视图；
4. 便签桥：`进待办`/`现在做` 写入项目区；
5. 导入导出与测试。

## 待定

- 是否需要多执行者字段；当前只按单执行者设计；
- `acceptance` 是否需要独立的通过/退回状态；
- Markdown 导出是否纳入第一版。
