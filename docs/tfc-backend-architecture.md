# TFC Backend — Architecture DAG

## Layered Architecture

```
+-----------------------------------------------------------+
| API/Routes Layer       (routers/*.py)                     |
+-----------------------------------------------------------+
| Application Services   (service.py, *_service.py)         |
+-----------------------------------------------------------+
| Domain & Business      (engine/ -- game_modes, managers)  |
+-----------------------------------------------------------+
| Data Access & Models   (repositories, models, schemas)    |
+-----------------------------------------------------------+
| Infrastructure & Core  (database, config, exceptions)     |
+-----------------------------------------------------------+
```

## Dependency DAG

```
                            +----------+
                            |  main.py |  <-- FastAPI app factory
                            +----+-----+
                                 | auto-discovers *_router.py
                 +---------------+-------------------------------+
                 v               v               v               v
         +--------------+ +-----------+ +------------+ +--------------+
         |exercise_router| |engine_    | |engine_     | |  ws_router   |
         |scenario_router| |router     | |actions_    | |  (WebSocket) |
         |decision_router| |           | |router      | |              |
         |audit_router   | +-----+-----+ +-----+------+ +------+-------+
         |domain_config_ |       |              |               |
         |  router       |       |              |               |
         |waiting_room_  |       |              |               |
         |  router       |       |              |               |
         |health_router  |       |              |               |
         +-------+-------+       |              |               |
                 |               |              |               |
    -------------+---------------+--------------+---------------+----
    SERVICE      v               v              |               v
    LAYER  +--------------+ +-------------+    |   +------------------+
           |*_service.py  | |engine_      |    |   |engine_broadcast  |
           |(Exercise,    | |decision_    |    |   |  split_targeted  |
           | Scenario,    | |service      |    |   |  broadcast_to_   |
           | Decision,    | +------+------+    |   |    roles         |
           | Audit,       |        |           |   +--------+---------+
           | DomainConfig)|        |           |            |
           +------+-------+        |           |            |
                  |                |           |            |
    --------------+----------------+-----------+------------+--------
    ADAPTERS      |                |           |            |
                  |         +------+-----------+------------+
                  |         v
                  |   +------------------+   +------------------+
                  |   |connection_manager|<--|presence_service  |
                  |   |  (WS registry)   |   |  (WS + waiting   |
                  |   +------------------+   |   room merge)    |
                  |                          +--------+---------+
                  |                                   |
    --------------+-----------------------------------+----------
    REPO          v                                   |
    LAYER  +--------------+                           |
           |*_repository  |                           |
           |(extends      |                           |
           | CrudRepo[T]) |                           |
           +------+-------+                           |
                  |                                   |
    --------------+-----------------------------------+----------
    IN-MEMORY     |                                   v
    STORES        |             +--------------+ +-------------+
                  |             |session_store | |waiting_room |
                  |             |{id->Engine}  | |_store       |
                  |             +------+-------+ +-------------+
                  |                    |
    --------------+--------------------+-------------------------
    DOMAIN        |                    v
    (ENGINE)      |         +--------------------+
                  |         |  ExerciseEngine     |
                  |         |  (orchestrator)     |
                  |         +--+--+--+--+--+-----+
                  |            |  |  |  |  |
                  |     +------+  |  |  |  +----------+
                  |     v         v  v  v             v
                  |  +-------+ +----++------++--------++----------+
                  |  |Time   | |Evt ||Issue ||Decision||GameMode  |
                  |  |Manager| |Schd||Mgr   ||Manager ||(Protocol)|
                  |  +---+---+ +-+--++--+---++---+----++----+-----+
                  |      |       |      |        |          |
                  |      +-------+------+--------+    +-----+------+
                  |              |                     v            v
                  |      +-------+------+       +----------++-----------+
                  |      |state_changes |       |ClassicMod||SimpleCollab|
                  |      |(TypedDicts)  |       |          ||Mode       |
                  |      +--------------+       +----------++-----------+
                  |
    --------------+----------------------------------------------
    CONTENT       |
    BRIDGE        |      +------------------+
                  |      |scenario_loader   |---> engine/*
                  |      |(content->runtime)|
                  |      +--------+---------+
                  |               |
                  |      +--------v---------+
                  |      |scenario_content  |
                  |      |(Pydantic models) |
                  |      +-----------------+
                  |
    --------------+----------------------------------------------
    MODELS        v
    (ORM)  +--------------+
           |Exercise      |--FK--> DomainConfig
           |Scenario      |--FK--> DomainConfig
           |Decision      |--FK--> Exercise
           |DecisionResp  |--FK--> Decision
           |AuditEntry    |--FK--> Exercise
           |DomainConfig  |
           +--------------+
                  |
    --------------+----------------------------------------------
    CORE/         v
    INFRA  +---------+ +--------+ +-----------+ +------------+
           |database | |config  | |exceptions | |base_repo   |
           |(engine, | |(Settngs| |(AppError  | |(CrudRepo[T])|
           | Base,   | | .env)  | | tree)     | |            |
           | session)| +--------+ +-----------+ +------------+
           +---------+
           +----------+ +------------+ +----------------+
           |auth.py   | |base_schema | |dependencies.py |
           |(stub     | |(ResponseBas| |(lazy DI wiring)|
           | user)    | |)           | |                |
           +----------+ +------------+ +----------------+
```

## Key Dependency Flows

### 1. HTTP Request -> DB

```
Router -> Service -> Repository -> CrudRepository[Model] -> SQLAlchemy Session
```

### 2. Engine Initialization

```
engine_router -> scenario_loader.build_engine_config(scenario_content)
             -> EngineConfig (wires managers + game mode)
             -> session_store.create(config) -> ExerciseEngine instance
```

### 3. Real-Time Broadcasting

```
ExerciseEngine.tick() -> StateChange dicts
  -> broadcast_changes() -> split by target_roles
  -> connection_manager -> WebSocket.send_text()
```

### 4. Waiting Room -> Engine

```
waiting_room_router -> waiting_room_store (in-memory)
  -> engine_router starts engine
  -> presence_service merges WS connections + waiting_room participants
  -> broadcasts presence to GM
```

## Module Summary

| Module | Layer | Depends On | Role |
|--------|-------|-----------|------|
| core/config | Infrastructure | - | App configuration |
| core/database | Infrastructure | - | SQLAlchemy setup |
| core/auth | Infrastructure | - | Stub auth |
| core/exceptions | Infrastructure | - | Error handling |
| core/dependencies | Infrastructure | features/* (lazy) | DI wiring |
| core/middleware | Infrastructure | - | CORS + error handler |
| core/base_repository | Infrastructure | - | Generic CRUD |
| engine/exercise_engine | Domain | time_manager, event_scheduler, issue_manager, decision_manager, game_modes | Core orchestrator |
| engine/session_store | Domain | exercise_engine | Engine registry (singleton) |
| engine/game_modes | Domain | state_changes | Strategy pattern (ClassicMode, SimpleCollaborativeMode) |
| engine/state_changes | Domain | - | TypedDicts for engine events |
| features/scenario/scenario_loader | Feature | engine/*, scenario_content | Content -> runtime bridge |
| features/*_repository | Data Access | core/base_repository, *_model | DB queries |
| features/*_service | Business Logic | *_repository, *_schema | CRUD orchestration |
| features/*_router | API | *_service | REST endpoints |
| features/exercise/adapters | Feature | connection_manager, presence_service | WebSocket + presence |
| features/waiting_room | In-Memory | - | Lobby state (singleton) |
| main.py | Entry Point | core/*, all routers | FastAPI factory |

## Architectural Patterns

- **Strategy Pattern** -- GameMode is a Protocol; ClassicMode and SimpleCollaborativeMode are injected at runtime
- **Singleton Stores** -- session_store, waiting_room_store, connection_manager are process-global
- **TypedDict Broadcasting** -- state_changes.py uses TypedDicts (not Pydantic) for zero-overhead engine events
- **Lazy DI** -- core/dependencies.py imports inside function bodies to break circular import chains
- **Re-exports** -- core/game_mode_constants.py shields features from direct engine imports
- **Auto-Discovery** -- main.py finds *_router.py files in features/ automatically
