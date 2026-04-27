# 实现计划：书籍管理系统

## 概述

基于 Electron + React 18 + TypeScript + SQLite 技术栈，实现一个本地书籍库存管理桌面应用。实现按照从底层数据库到上层 UI 的顺序推进，先搭建项目基础结构和数据库层，再实现业务服务层，最后构建前端页面和交互。

## 任务

- [x] 1. 搭建项目基础结构
  - [x] 1.1 初始化 Electron + React + TypeScript 项目
    - 使用 Vite 创建项目，配置 Electron 主进程和渲染进程入口
    - 安装核心依赖：react, react-dom, electron, typescript, vite, electron-builder
    - 安装业务依赖：better-sqlite3, drizzle-orm, zustand, antd, xlsx, sharp
    - 安装开发依赖：vitest, @types/better-sqlite3
    - 配置 tsconfig.json（主进程和渲染进程分别配置）
    - 配置 Vite 构建（渲染进程）和 Electron 主进程编译
    - _需求: 1.1, 1.2_

  - [x] 1.2 创建共享类型定义和常量
    - 创建 `src/shared/types.ts`，定义所有业务实体类型接口（Book, Edition, Location, InboundRecord, OutboundRecord, Stock, OperationLog, StocktakingTask, StocktakingItem, BackupInfo, DashboardData, BatchResultSummary, ImportResultSummary, PriceStats, ProfitDetail 等）
    - 创建 `src/shared/constants.ts`，定义业务常量（图片大小限制 5MB、支持的图片格式、操作类型枚举等）
    - 创建 `src/shared/ipc-channels.ts`，定义所有 IPC 通道名称常量
    - _需求: 1.1, 2.1, 2.4, 3.1, 4.1, 5.1_

  - [x] 1.3 实现数据库初始化和 Schema 定义
    - 创建 `src/main/db/schema.ts`，使用 Drizzle ORM 定义所有数据表：books, editions, locations, stock, inbound_records, outbound_records, operation_logs, book_images, edition_images, stocktaking_tasks, stocktaking_items, backup_info
    - 实现唯一性约束：books.isbn 全局唯一、editions(book_id, name) 组合唯一、locations(warehouse, shelf, layer) 组合唯一、stock(book_id, edition_id, location_id) 组合唯一
    - 实现业务约束：stock.quantity >= 0、入库/出库数量 > 0、价格 >= 0
    - 创建 `src/main/db/index.ts`，实现数据库连接初始化（使用 better-sqlite3）、启用 WAL 模式和外键约束
    - 实现数据库文件损坏检测，损坏时返回错误信息
    - _需求: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 检查点 - 确保项目基础结构搭建完成
  - 确保所有依赖安装成功，TypeScript 编译无错误，数据库初始化正常。如有问题请向用户确认。

- [ ] 3. 实现书籍与版本管理服务
  - [x] 3.1 实现 BookService
    - 创建 `src/main/services/book.service.ts`
    - 实现 `create` 方法：校验 ISBN 唯一性，创建书籍记录，记录操作日志
    - 实现 `update` 方法：更新书籍信息，记录修改时间戳，记录操作日志
    - 实现 `delete` 方法：校验所有版本库存数量，有库存 > 0 时拒绝删除并返回关联库存列表，删除时同时删除关联图片文件，记录操作日志
    - 实现 `getById` 方法：返回书籍及其所有版本信息
    - 实现 `search` 方法：按书名、作者、ISBN、分类、版本名称模糊匹配
    - 实现 `list` 方法：分页查询书籍列表
    - _需求: 2.1, 2.2, 2.3, 2.9, 2.10, 2.11, 2.12_

  - [x] 3.2 实现 EditionService
    - 创建 `src/main/services/edition.service.ts`
    - 实现 `create` 方法：校验同一 ISBN 下版本名称唯一性，创建版本记录并关联书籍，记录操作日志
    - 实现 `update` 方法：更新版本信息，记录修改时间戳，记录操作日志
    - 实现 `delete` 方法：校验版本库存数量，有库存 > 0 时拒绝删除并返回关联库存列表，删除时同时删除关联图片文件，记录操作日志
    - _需求: 2.4, 2.5, 2.6, 2.7, 2.8, 2.13, 2.14_

  - [ ] 3.3 编写书籍与版本服务的单元测试
    - 测试 ISBN 唯一性校验（重复 ISBN 创建应失败）
    - 测试版本名称唯一性校验（同一书籍下重复版本名称应失败）
    - 测试有库存时拒绝删除书籍和版本
    - 测试搜索功能的模糊匹配
    - _需求: 2.2, 2.3, 2.6, 2.7, 2.11, 2.12, 2.13, 2.14_

- [ ] 4. 实现位置管理服务
  - [x] 4.1 实现 LocationService
    - 创建 `src/main/services/location.service.ts`
    - 实现 `create` 方法：校验仓库+书架+层号组合唯一性，创建位置记录，记录操作日志
    - 实现 `update` 方法：更新位置信息，记录修改时间戳，记录操作日志
    - 实现 `delete` 方法：校验位置下是否有库存 > 0 的记录，有则拒绝删除并返回库存列表，记录操作日志
    - 实现 `list` 方法：返回所有位置
    - 实现 `getStock` 方法：返回指定位置的所有库存单元及数量
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 4.2 编写位置管理服务的单元测试
    - 测试位置组合唯一性校验
    - 测试有库存时拒绝删除位置
    - _需求: 3.3, 3.4, 3.7, 3.8_

- [ ] 5. 实现库存与预警服务
  - [x] 5.1 实现 StockService
    - 创建 `src/main/services/stock.service.ts`
    - 实现 `getStockQuantity` 方法：查询特定库存单元在特定位置的数量
    - 实现 `adjustStock` 方法：调整库存数量（delta 可正可负），结果为负时抛出异常
    - 实现 `getTotalStock` 方法：查询库存单元在所有位置的总数量
    - 实现 `list` 方法：支持按书名、分类、版本名称、位置筛选，库存为零时标记"缺货"
    - 实现 `summary` 方法：汇总视图，显示每个库存单元在所有位置的总库存数量
    - _需求: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.2 实现 AlertService
    - 创建 `src/main/services/alert.service.ts`
    - 实现 `setThreshold` 方法：设置/更新库存单元的预警阈值，记录修改时间戳
    - 实现 `checkAlert` 方法：检查库存单元总库存是否低于或等于预警阈值，更新预警状态
    - 实现 `getAlertList` 方法：返回所有处于预警状态的库存单元及其当前总库存数量和预警阈值
    - 未设置预警阈值的库存单元不进行预警检查
    - _需求: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ] 5.3 编写库存与预警服务的单元测试
    - 测试库存调整为负数时抛出异常
    - 测试预警状态的触发和解除
    - 测试未设置阈值时不触发预警
    - _需求: 8.3, 12.3, 12.4, 12.7_

- [ ] 6. 实现入库管理服务
  - [x] 6.1 实现 InboundService
    - 创建 `src/main/services/inbound.service.ts`
    - 实现 `create` 方法：在事务中校验书籍/版本/位置存在性，创建入库记录，增加库存数量，自动记录操作时间戳和操作日志
    - 实现 `update` 方法：在事务中处理位置变更（原位置减库存、新位置加库存）和数量变更（调整库存差值），校验库存不为负，更新记录，记录操作日志。禁止修改书籍标识和版本标识
    - 实现 `delete` 方法：在事务中校验减少库存后不为负，减少库存，删除记录，记录操作日志。删除前显示确认信息和库存变更预览
    - 实现 `list` 方法：支持按书籍标识、版本标识、日期范围、位置筛选
    - 实现 `batchCreate` 方法：逐条独立校验和执行，失败记录跳过继续处理，返回处理结果摘要
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 9.1, 9.3, 9.5, 9.7, 9.9, 9.10, 10.1, 10.3, 10.4, 10.5, 10.6, 15.1, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ] 6.2 编写入库管理服务的单元测试
    - 测试书籍/版本/位置不存在时拒绝入库
    - 测试入库后库存数量正确增加
    - 测试编辑入库记录时库存数量正确调整
    - 测试删除入库记录导致库存为负时拒绝操作
    - 测试批量入库的成功/失败汇总
    - _需求: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.3, 9.7, 10.1, 10.3, 15.3, 15.4, 15.6_

- [ ] 7. 实现出库管理服务
  - [x] 7.1 实现 OutboundService
    - 创建 `src/main/services/outbound.service.ts`
    - 实现 `create` 方法：在事务中校验库存充足性（库存数量 >= 出库数量），创建出库记录，减少库存数量，自动记录操作时间戳和操作日志。库存不足时拒绝并显示当前可用库存数量
    - 实现 `update` 方法：在事务中处理位置变更和数量变更，校验库存不为负，更新记录，记录操作日志。禁止修改书籍标识和版本标识
    - 实现 `delete` 方法：在事务中增加库存数量，删除记录，记录操作日志。删除前显示确认信息和库存变更预览
    - 实现 `list` 方法：支持按书籍标识、版本标识、日期范围、位置筛选
    - 实现 `batchCreate` 方法：逐条独立校验和执行，失败记录跳过继续处理，返回处理结果摘要
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.2, 9.4, 9.6, 9.8, 9.9, 9.10, 10.2, 10.4, 10.5, 10.6, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ] 7.2 编写出库管理服务的单元测试
    - 测试库存不足时拒绝出库
    - 测试出库后库存数量正确减少
    - 测试编辑出库记录时库存数量正确调整
    - 测试批量出库的成功/失败汇总
    - _需求: 5.2, 5.3, 5.4, 9.4, 9.8, 10.2, 15.3, 15.4, 15.6_

- [x] 8. 检查点 - 确保核心业务服务层完成
  - 确保所有测试通过，入库/出库/库存/预警的核心逻辑正确。如有问题请向用户确认。

- [ ] 9. 实现价格与利润服务
  - [x] 9.1 实现 PriceService
    - 创建 `src/main/services/price.service.ts`
    - 实现 `getPurchaseHistory` 方法：返回库存单元所有入库记录的买入价格、入库日期、数量和供应商信息
    - 实现 `getSellingHistory` 方法：返回库存单元所有出库记录的售出价格、出库日期、数量和买家信息
    - 实现 `getStats` 方法：计算最近买入/售出价格、买入价格范围、平均买入价格（按数量加权）、平均售出价格（按数量加权）。无记录时返回"暂无数据"标识
    - _需求: 6.1, 6.2, 6.3, 6.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_

  - [x] 9.2 实现 ProfitService
    - 创建 `src/main/services/profit.service.ts`
    - 实现 `calculateByStockUnit` 方法：计算库存单元的总采购成本、总销售收入和净利润
    - 实现 `calculateByBook` 方法：汇总书籍所有版本的利润数据
    - 实现 `calculateByCategory` 方法：汇总分类下所有书籍的利润数据
    - 所有方法支持按日期范围筛选
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 9.3 编写价格与利润服务的单元测试
    - 测试加权平均价格计算的正确性
    - 测试无记录时返回"暂无数据"
    - 测试日期范围筛选的利润计算
    - _需求: 6.3, 6.4, 7.4, 8.10, 8.11_

- [ ] 10. 实现操作日志服务
  - [x] 10.1 实现 LogService
    - 创建 `src/main/services/log.service.ts`
    - 实现 `create` 方法：记录操作日志，包含操作类型（创建/编辑/删除/盘点调整）、操作对象类型、操作对象标识、操作时间、变更前数据和变更后数据
    - 实现 `list` 方法：支持按操作类型、日期范围、操作对象类型和标识筛选，按操作时间倒序排列
    - 将操作日志持久化存储到本地数据库
    - _需求: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

  - [ ] 10.2 编写操作日志服务的单元测试
    - 测试创建/编辑/删除操作的日志记录内容
    - 测试筛选和排序功能
    - _需求: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7, 14.8_

- [ ] 11. 实现仪表盘服务
  - [x] 11.1 实现 DashboardService
    - 创建 `src/main/services/dashboard.service.ts`
    - 实现 `getData` 方法：计算并返回总库存量、预警库存单元数量、今日入库数量/金额、今日出库数量/金额、本月利润汇总、预警库存单元列表
    - 无数据时各项指标显示为零，无预警时显示"当前无库存预警"
    - _需求: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.10, 17.12, 17.13_

  - [ ] 11.2 编写仪表盘服务的单元测试
    - 测试各项指标的计算逻辑
    - 测试无数据时返回零值
    - _需求: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.12_

- [ ] 12. 实现盘点服务
  - [x] 12.1 实现 StocktakingService
    - 创建 `src/main/services/stocktaking.service.ts`
    - 实现 `create` 方法：创建盘点任务，支持按位置或按分类选择盘点范围，加载范围内所有库存单元的系统数量，状态设为"进行中"
    - 实现 `recordActual` 方法：保存实际数量，自动计算差异数量（实际 - 系统），标记盘盈/盘亏/一致
    - 实现 `submit` 方法：生成盘点报告，汇总盘盈/盘亏/一致数量，检查未录入的库存单元并提示
    - 实现 `confirm` 方法：在事务中将库存数量调整为实际数量，为每个变化的库存单元记录操作日志（类型为"盘点调整"），更新任务状态为"已完成"
    - 盘点范围内无库存单元时显示提示信息
    - _需求: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11, 18.12, 18.13, 18.14, 18.15, 18.16_

  - [ ] 12.2 编写盘点服务的单元测试
    - 测试差异数量计算和状态标记
    - 测试盘点调整后库存数量正确更新
    - 测试盘点调整的操作日志记录
    - _需求: 18.5, 18.7, 18.8, 18.9, 18.12, 18.14_

- [ ] 13. 实现数据备份恢复、导入导出和图片服务
  - [x] 13.1 实现 BackupService
    - 创建 `src/main/services/backup.service.ts`
    - 实现 `create` 方法：将 SQLite 数据库文件复制到用户指定路径，记录备份时间和路径。路径不可写入时返回错误
    - 实现 `restore` 方法：从备份文件恢复数据库，覆盖当前数据，恢复后重新加载数据。文件无效或损坏时返回错误
    - 实现 `getLatest` 方法：返回最近一次成功备份的时间和路径
    - _需求: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 13.2 实现 ExportService
    - 创建 `src/main/services/export.service.ts`
    - 使用 xlsx (SheetJS) 库实现导出功能
    - 实现入库记录导出：支持按书籍、版本、日期范围、位置、供应商筛选，导出 Excel/CSV
    - 实现出库记录导出：支持按书籍、版本、日期范围、位置、买家筛选，导出 Excel/CSV
    - 实现库存信息导出：支持按书名、分类、版本名称、位置筛选，导出 Excel/CSV
    - 实现利润统计导出：支持按分类、日期范围筛选，导出 Excel/CSV
    - 导出文件包含与系统一致的列标题，无数据时提示"当前筛选条件下无数据可导出"
    - _需求: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 13.3 实现 ImportService
    - 创建 `src/main/services/import.service.ts`
    - 使用 xlsx (SheetJS) 库实现导入功能
    - 实现 `getTemplate` 方法：生成包含书名、作者、ISBN、分类、描述五列的导入模板（Excel/CSV）
    - 实现 `importBooks` 方法：校验文件格式（.xlsx/.csv）、校验必需列标题、逐条校验记录（含 ISBN 唯一性，包括本次已导入的记录）、失败跳过继续处理、返回导入结果摘要（含行号和失败原因）
    - 空文件提示"导入文件中无数据记录"
    - _需求: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12, 16.13, 16.14_

  - [x] 13.4 实现 ImageService
    - 创建 `src/main/services/image.service.ts`
    - 使用 sharp 库处理图片
    - 实现 `upload` 方法：校验图片格式（JPG/PNG）和大小（≤5MB），保存原图到本地存储，使用 sharp 生成缩略图，关联到书籍或版本。已有图片时替换并删除原文件
    - 实现 `delete` 方法：删除图片文件并解除关联
    - 实现 `get` / `getThumbnail` 方法：返回图片/缩略图路径，版本优先显示版本封面，无版本封面时显示书籍默认封面，均无时返回 null（前端显示占位图）
    - _需求: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.13, 19.14, 19.15_

  - [ ] 13.5 编写备份恢复、导入导出和图片服务的单元测试
    - 测试导入文件格式校验和列标题校验
    - 测试导入时 ISBN 唯一性校验（含本次已导入记录）
    - 测试图片格式和大小校验
    - 测试图片显示优先级（版本封面 > 书籍默认封面 > 占位图）
    - _需求: 16.4, 16.5, 16.6, 16.7, 16.9, 19.3, 19.4, 19.5, 19.6, 19.13, 19.14, 19.15_

- [x] 14. 检查点 - 确保所有业务服务层完成
  - 确保所有测试通过，所有服务层逻辑正确。如有问题请向用户确认。


- [x] 15. 注册 IPC 处理器
  - [x] 15.1 实现所有 IPC 处理器注册
    - 创建 `src/main/ipc/book.ipc.ts`：注册 book:create, book:update, book:delete, book:getById, book:search, book:list 通道，调用 BookService
    - 创建 `src/main/ipc/edition.ipc.ts`：注册 edition:create, edition:update, edition:delete 通道，调用 EditionService
    - 创建 `src/main/ipc/location.ipc.ts`：注册 location:create, location:update, location:delete, location:list, location:getStock 通道，调用 LocationService
    - 创建 `src/main/ipc/inbound.ipc.ts`：注册 inbound:create, inbound:update, inbound:delete, inbound:list, inbound:batchCreate 通道，调用 InboundService
    - 创建 `src/main/ipc/outbound.ipc.ts`：注册 outbound:create, outbound:update, outbound:delete, outbound:list, outbound:batchCreate 通道，调用 OutboundService
    - 创建 `src/main/ipc/stock.ipc.ts`：注册 stock:list, stock:summary, stock:setAlert, stock:alertList 通道
    - 创建 `src/main/ipc/dashboard.ipc.ts`：注册 dashboard:getData 通道
    - 创建 `src/main/ipc/stocktaking.ipc.ts`：注册 stocktaking:create, stocktaking:list, stocktaking:getDetail, stocktaking:recordActual, stocktaking:submit, stocktaking:confirm 通道
    - 创建 `src/main/ipc/backup.ipc.ts`：注册 backup:create, backup:restore, backup:latest 通道
    - 创建 `src/main/ipc/export.ipc.ts`：注册 export:inbound, export:outbound, export:stock, export:profit 通道
    - 创建 `src/main/ipc/import.ipc.ts`：注册 import:template, import:books 通道
    - 创建 `src/main/ipc/log.ipc.ts`：注册 log:list 通道
    - 创建 `src/main/ipc/image.ipc.ts`：注册 image:upload, image:delete, image:get, image:thumbnail 通道
    - _需求: 1.1, 1.2, 1.3_

  - [x] 15.2 实现 IPC 客户端封装
    - 创建 `src/renderer/utils/ipc.ts`，封装 ipcRenderer.invoke 调用，提供类型安全的 API 函数供前端组件调用
    - 创建 Electron preload 脚本，安全暴露 IPC 通信接口到渲染进程
    - _需求: 1.1_

  - [x] 15.3 实现 Electron 主进程入口
    - 创建 `src/main/index.ts`，初始化数据库、注册所有 IPC 处理器、创建 BrowserWindow、加载渲染进程
    - 实现数据库启动时加载和错误处理
    - _需求: 1.2, 1.4_

- [x] 16. 实现前端布局和路由
  - [x] 16.1 实现应用布局和导航
    - 创建 `src/renderer/App.tsx`，配置 React Router 路由
    - 创建 `src/renderer/components/Layout.tsx`，实现 Ant Design 的 Layout 布局（侧边栏 + 内容区）
    - 创建 `src/renderer/components/Sidebar.tsx`，实现侧边导航菜单，包含：仪表盘、书籍管理、位置管理、入库管理、出库管理、库存查询、价格历史、利润统计、库存预警、库存盘点、操作日志、数据导出、数据导入、备份恢复
    - 创建 `src/renderer/main.tsx`，渲染进程入口
    - _需求: 17.9_

- [x] 17. 实现仪表盘页面
  - [x] 17.1 实现 Dashboard 页面
    - 创建 `src/renderer/pages/Dashboard.tsx`
    - 使用 Ant Design 的 Card 和 Statistic 组件展示：总库存量、预警库存单元数量、今日入库数量/金额、今日出库数量/金额、本月利润汇总
    - 实现库存预警列表，显示预警库存单元及其封面缩略图、当前总库存数量和预警阈值
    - 点击预警列表中的库存单元跳转到库存详情页面
    - 页面加载时从主进程获取最新数据，返回仪表盘时重新计算
    - 无数据时显示零值，无预警时显示"当前无库存预警"
    - _需求: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12, 17.13, 19.16_

  - [x] 17.2 实现 DashboardStore
    - 创建 `src/renderer/stores/dashboardStore.ts`，使用 Zustand 管理仪表盘数据状态
    - _需求: 17.10, 17.11_

- [x] 18. 实现书籍管理页面
  - [x] 18.1 实现书籍列表页面
    - 创建 `src/renderer/pages/BookList.tsx`
    - 使用 Ant Design Table 展示书籍列表，显示封面缩略图、书名、作者、ISBN、分类
    - 实现搜索功能（按书名、作者、ISBN、分类搜索）
    - 实现新增书籍按钮，弹出书籍表单
    - 实现编辑和删除操作（删除需确认）
    - _需求: 2.1, 2.9, 2.10, 2.11, 2.12, 19.11_

  - [x] 18.2 实现书籍详情页面
    - 创建 `src/renderer/pages/BookDetail.tsx`
    - 显示书籍基本信息和默认封面图片
    - 显示版本列表，每个版本显示版本封面图片（无版本封面时显示书籍默认封面，均无时显示占位图）
    - 实现添加版本、编辑版本、删除版本操作
    - _需求: 2.4, 2.5, 2.6, 2.7, 2.8, 2.13, 2.14, 19.13, 19.14, 19.15_

  - [x] 18.3 实现书籍和版本表单组件
    - 创建 `src/renderer/components/BookForm.tsx`，包含书名、作者、ISBN、分类、描述字段，前端校验必填项
    - 创建 `src/renderer/components/EditionForm.tsx`，包含版本名称字段
    - _需求: 2.1, 2.4_

  - [x] 18.4 实现 BookStore
    - 创建 `src/renderer/stores/bookStore.ts`，使用 Zustand 管理书籍列表和搜索状态
    - _需求: 2.10_

- [x] 19. 实现位置管理页面
  - [x] 19.1 实现位置列表页面
    - 创建 `src/renderer/pages/LocationList.tsx`
    - 使用 Ant Design Table 展示位置列表（仓库名称、书架编号、层号）
    - 实现新增位置按钮，弹出位置表单
    - 实现编辑和删除操作（删除需确认，有库存时显示关联库存列表）
    - 点击位置可查看该位置下的所有库存单元
    - _需求: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 19.2 实现位置表单组件
    - 创建 `src/renderer/components/LocationForm.tsx`，包含仓库名称、书架编号、层号字段
    - _需求: 3.2_

  - [x] 19.3 实现 LocationStore
    - 创建 `src/renderer/stores/locationStore.ts`，使用 Zustand 管理位置列表状态
    - _需求: 3.5_

- [x] 20. 实现入库管理页面
  - [x] 20.1 实现入库记录列表页面
    - 创建 `src/renderer/pages/InboundList.tsx`
    - 使用 Ant Design Table 展示入库记录列表
    - 实现筛选功能（按书籍、版本、日期范围、位置筛选）
    - 实现新增入库、编辑入库、删除入库操作（删除需确认，显示库存变更预览）
    - _需求: 4.1, 4.8, 4.9, 9.1, 9.9, 9.10, 10.1, 10.3, 10.4, 10.5, 10.6_

  - [x] 20.2 实现入库表单组件
    - 创建 `src/renderer/components/InboundForm.tsx`，包含书籍选择、版本选择、入库日期、数量、目标位置、买入价格、供应商字段
    - 编辑模式下禁用书籍和版本字段
    - _需求: 4.1, 9.1, 9.10_

  - [x] 20.3 实现批量入库表单组件
    - 创建 `src/renderer/components/BatchInboundForm.tsx`，支持一次性添加多条入库记录
    - 提交后显示处理结果摘要（成功数、失败数及失败原因）
    - _需求: 15.1, 15.6, 15.7_

- [x] 21. 实现出库管理页面
  - [x] 21.1 实现出库记录列表页面
    - 创建 `src/renderer/pages/OutboundList.tsx`
    - 使用 Ant Design Table 展示出库记录列表
    - 实现筛选功能（按书籍、版本、日期范围、位置筛选）
    - 实现新增出库、编辑出库、删除出库操作（删除需确认，显示库存变更预览）
    - _需求: 5.1, 5.5, 5.6, 9.2, 9.9, 9.10, 10.2, 10.4, 10.5, 10.6_

  - [x] 21.2 实现出库表单组件
    - 创建 `src/renderer/components/OutboundForm.tsx`，包含书籍选择、版本选择、出库日期、数量、来源位置、售出价格、买家字段
    - 编辑模式下禁用书籍和版本字段
    - _需求: 5.1, 9.2, 9.10_

  - [x] 21.3 实现批量出库表单组件
    - 创建 `src/renderer/components/BatchOutboundForm.tsx`，支持一次性添加多条出库记录
    - 提交后显示处理结果摘要
    - _需求: 15.2, 15.6, 15.7_

- [x] 22. 检查点 - 确保核心页面功能完成
  - 确保所有测试通过，书籍/位置/入库/出库的 CRUD 页面功能正常。如有问题请向用户确认。

- [x] 23. 实现库存查询与价格历史页面
  - [x] 23.1 实现库存列表页面
    - 创建 `src/renderer/pages/StockList.tsx`
    - 使用 Ant Design Table 展示库存列表，显示封面缩略图、书名、版本名称、位置、库存数量、库存状态（缺货标记）、最近买入价格、最近售出价格、买入价格范围、平均买入价格、平均售出价格
    - 无记录时价格列显示"暂无数据"
    - 预警状态的库存单元进行视觉标识（高亮或图标）
    - 实现筛选功能（按书名、分类、版本名称、位置筛选）
    - 实现汇总视图切换，显示每个库存单元在所有位置的总库存数量
    - 实现预警阈值设置入口
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 12.6, 19.12_

  - [x] 23.2 实现 StockStore
    - 创建 `src/renderer/stores/stockStore.ts`，使用 Zustand 管理库存列表和筛选状态
    - _需求: 8.2_

  - [x] 23.3 实现价格历史页面
    - 创建 `src/renderer/pages/PriceHistory.tsx`
    - 显示库存单元的买入价格历史列表（买入价格、入库日期、数量、供应商）
    - 显示库存单元的售出价格历史列表（售出价格、出库日期、数量、买家）
    - 显示平均买入价格和平均售出价格
    - _需求: 6.1, 6.2, 6.3, 6.4_

- [x] 24. 实现利润统计与预警页面
  - [x] 24.1 实现利润统计页面
    - 创建 `src/renderer/pages/ProfitReport.tsx`
    - 显示库存单元级别的利润详情（总采购成本、总销售收入、净利润）
    - 支持按书籍、分类汇总利润
    - 支持按日期范围筛选
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 24.2 实现预警列表页面
    - 创建 `src/renderer/pages/AlertList.tsx`
    - 显示所有处于预警状态的库存单元列表（库存单元信息、当前总库存数量、预警阈值）
    - _需求: 12.5, 12.6_

- [x] 25. 实现盘点管理页面
  - [x] 25.1 实现盘点任务列表页面
    - 创建 `src/renderer/pages/StocktakingList.tsx`
    - 显示盘点任务列表（盘点范围、创建时间、状态）
    - 实现创建盘点任务功能，支持按位置或按分类选择盘点范围
    - _需求: 18.1, 18.2, 18.3_

  - [x] 25.2 实现盘点详情页面
    - 创建 `src/renderer/pages/StocktakingDetail.tsx`
    - 显示盘点任务中每个库存单元的系统数量、实际数量输入框、差异数量和差异状态（盘盈/盘亏/一致）
    - 实现实际数量录入功能
    - 实现提交盘点结果功能，生成盘点报告（汇总盘盈/盘亏/一致数量）
    - 实现确认盘点结果功能，调整库存数量
    - 未录入实际数量时提示用户
    - 盘点范围内无库存单元时显示提示信息
    - _需求: 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11, 18.12, 18.13, 18.14, 18.15, 18.16_

- [x] 26. 实现操作日志、导入导出和备份恢复页面
  - [x] 26.1 实现操作日志页面
    - 创建 `src/renderer/pages/LogList.tsx`
    - 使用 Ant Design Table 展示操作日志列表，按操作时间倒序排列
    - 实现筛选功能（按操作类型、日期范围、操作对象类型和标识筛选）
    - 显示变更前后数据对比
    - _需求: 14.5, 14.6, 14.7, 14.8_

  - [x] 26.2 实现数据导出页面
    - 创建 `src/renderer/pages/ExportData.tsx`
    - 实现导出类型选择（入库记录、出库记录、库存信息、利润统计）
    - 实现各类型对应的筛选条件表单
    - 实现导出格式选择（Excel/CSV）
    - 提交后生成文件并提供下载
    - 无数据时提示"当前筛选条件下无数据可导出"
    - _需求: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 26.3 实现数据导入页面
    - 创建 `src/renderer/pages/ImportBooks.tsx`
    - 实现导入模板下载功能（Excel/CSV 格式）
    - 实现文件上传功能，校验文件格式
    - 提交后显示导入结果摘要（成功数、失败数、失败行号和原因）
    - _需求: 16.1, 16.2, 16.3, 16.4, 16.5, 16.12, 16.13, 16.14_

  - [x] 26.4 实现备份恢复页面
    - 创建 `src/renderer/pages/BackupRestore.tsx`
    - 显示最近一次成功备份的时间和路径
    - 实现备份功能：选择备份路径，执行备份
    - 实现恢复功能：选择备份文件，显示确认提示（说明将覆盖当前数据），执行恢复
    - 错误处理：路径不可写入、文件无效或损坏
    - _需求: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

- [x] 27. 实现图片管理组件
  - [x] 27.1 实现图片上传组件
    - 创建 `src/renderer/components/ImageUpload.tsx`
    - 实现图片上传功能，支持 JPG/PNG 格式，限制 5MB
    - 格式不支持时显示错误信息
    - 大小超限时显示错误信息
    - 支持替换已有图片和删除图片
    - 在书籍详情页和版本管理中集成图片上传组件
    - _需求: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

  - [x] 27.2 实现确认对话框组件
    - 创建 `src/renderer/components/ConfirmDialog.tsx`
    - 实现通用确认对话框，用于删除操作确认，显示详细信息和变更预览
    - _需求: 10.5, 13.4_

- [x] 28. 实现前端校验工具
  - [x] 28.1 实现前端校验和格式化工具
    - 创建 `src/renderer/utils/validation.ts`，实现前端表单校验规则（必填项、数值范围、ISBN 格式等）
    - 创建 `src/renderer/utils/format.ts`，实现价格格式化（人民币元）、日期格式化、数量格式化等工具函数
    - _需求: 2.1, 4.1, 5.1_

- [x] 29. 最终检查点 - 确保所有功能完成
  - 确保所有测试通过，所有页面功能正常，入库/出库/库存/价格/利润/预警/盘点/导入导出/备份恢复/操作日志/图片管理全部集成完毕。如有问题请向用户确认。

## 说明

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了对应的需求编号，确保需求可追溯
- 检查点任务用于阶段性验证，确保增量开发的正确性
- 单元测试验证具体示例和边界情况
- 实现顺序为：数据库层 → 业务服务层 → IPC 通信层 → 前端页面层，确保每一步都有可测试的基础