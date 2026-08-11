# MCP bridge

PortReeve exposes a local tools-only MCP bridge through the standalone executable:

```sh
portreeve mcp serve
```

An MCP host normally starts this command and communicates over its standard input and
standard output. The bridge opens no network listener, owns no database, and never
shells out to the PortReeve CLI. Every daemon-backed tool uses the official JavaScript
client over the same private HTTP/JSON Unix socket as other integrations. Diagnostic
messages go to standard error; standard output contains MCP frames only.

The bridge accepts both the 2026-07-28 stateless `server/discover` flow and legacy
2025-era initialization through the official MCP SDK. Each bridge process has its own
run identifier and may be given a diagnostic label with `--label`. These values are
attribution, not authority.

The inspection surface reports bridge diagnostics, daemon compatibility and health,
settings, ports, claims, stacks, generations, activations, and structured history.
Global collection tools default to 50 results, permit at most 200, and return opaque
continuation cursors; launcher-operation history is independently retained and bounded
to twenty records per stack. Diagnostics remain usable while the daemon is absent or
incompatible; daemon-backed calls return stable structured errors and automatically
retry the socket on later calls.

The coordination surface supports standalone acquire, confirm, abandon, and run
release plus stack status, prepare, activation begin, endpoint resolution, process or
Docker confirmation, optional skip, failure abandonment, reconciliation, and end.
Equivalent retries return the existing or already-achieved result instead of repeating
the effect.

The final coordination family adds one structured stack snapshot tool and five
launcher-operation tools. `portreeve_stack_snapshot` returns an in-memory, redacted
Docker-sandbox address document for an explicit activation, component, and gateway
host; it never writes a file. Launcher begin, renew, complete, get, and bounded list
coordinate lifecycle ownership only. They never execute the project's start, stop,
restart, or status command. Begin requires a caller operation ID for retry identity and
the exact launcher revision that the external launcher is using.

Normal reclaim, claim reassignment/deletion/pruning, stack document apply and pruning,
and public settings changes use focused preview and execute tools. Preview persists the
daemon's current evidence in a five-minute receipt. Execute sends only that receipt and
the explicit target; the daemon recovers the stored proposal, recomputes process,
Docker, registry, settings, or document-fingerprint evidence, and rejects stale state.
A completed receipt replays its recorded result. Canonical stack tools accept an
explicit stack root and typed definition, read or write only `portreeve.stack.json`, and
never expose raw file contents or general filesystem authority.

Raw lease tokens and launcher-operation credentials never cross MCP. The bridge keeps
them only in process-local vaults and returns unguessable credential handles that
cannot be used by another bridge process. Pending leases and active launcher
operations renew automatically no later than one-third of their observed remaining TTL
or ten seconds, whichever comes first. Custody lasts ten minutes by default;
activation custody and launcher custody may be explicitly extended to at most sixty
minutes from acquisition. Confirmation, skip, abandonment, or launcher completion
erases the corresponding credential immediately. Custody expiry or bridge exit erases
all remaining credentials and stops renewal, leaving ordinary daemon expiry and
reconciliation to recover durable state.

PortReeve does not expose MCP resources, prompts, subscriptions, HTTP transport,
server lifecycle administration, unsafe any-owner eviction, arbitrary shell or
filesystem access, or raw logs and project-command output. The registered tool names
exactly match the frozen 51-tool catalog.

## Configure an MCP host

Generate a setup preview for Codex, Claude Code, or a generic stdio host:

```sh
portreeve mcp setup --host codex
portreeve mcp setup --host claude-code
portreeve mcp setup --host generic
```

The default preview uses PortReeve's exact managed executable path. This is the most
reliable choice for GUI applications, which may inherit a restricted `PATH`, and that
managed location remains stable when PortReeve upgrades its executable. Use
`--portable` only when the host environment can find bare `portreeve` on its `PATH`:

```sh
portreeve mcp setup --host codex --portable
```

Add `--label NAME` for a diagnostic bridge label or `--json` for a versioned
machine-readable result. The label identifies a bridge in diagnostics; it grants no
authority and does not choose a stack, worktree, claim, or activation.

For Codex, the generated TOML uses the supported `[mcp_servers.portreeve]` shape and
also includes an equivalent `codex mcp add` command. For Claude Code, the generated
JSON uses a stdio entry under `mcpServers` and includes an equivalent
`claude mcp add --scope user` command. The generic form is the canonical stdio server
descriptor with `type`, `command`, and `args`.

PortReeve only prints these snippets and commands. It never reads or writes Codex,
Claude Code, or another host's settings. The Desktop **MCP** tab provides the same
formats, exact/portable selection, optional labels, daemon compatibility evidence,
copy actions, and visible setup errors through its restricted main-process boundary.
It does not launch an agent host or execute project commands.

<!-- PORTREEVE:GENERATED MCP-TOOLS START -->
## Complete tool reference

> Generated from the exact tool catalog registered with the pinned MCP SDK. Do not edit this region directly.

### MCP tool: `portreeve_health`

Read compatible daemon health and capability evidence.

- **Title:** PortReeve health
- **Family:** diagnostics
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_health`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {},
  "type": "object"
}
```

#### Structured output schema for `portreeve_health`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "capabilities": {
              "items": {
                "minLength": 1,
                "type": "string"
              },
              "readOnly": true,
              "type": "array"
            },
            "mode": {
              "enum": [
                "manual",
                "supervised"
              ],
              "type": "string"
            },
            "pid": {
              "exclusiveMinimum": 0,
              "maximum": 9007199254740991,
              "type": "integer"
            },
            "protocol": {
              "additionalProperties": false,
              "properties": {
                "maximum": {
                  "exclusiveMinimum": 0,
                  "maximum": 9007199254740991,
                  "type": "integer"
                },
                "minimum": {
                  "exclusiveMinimum": 0,
                  "maximum": 9007199254740991,
                  "type": "integer"
                }
              },
              "required": [
                "minimum",
                "maximum"
              ],
              "type": "object"
            },
            "softwareVersion": {
              "minLength": 1,
              "type": "string"
            }
          },
          "required": [
            "softwareVersion",
            "protocol",
            "capabilities",
            "pid",
            "mode"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_compatibility`

Check whether the current daemon supports this MCP bridge.

- **Title:** PortReeve compatibility
- **Family:** diagnostics
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_compatibility`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {},
  "type": "object"
}
```

#### Structured output schema for `portreeve_compatibility`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "bridge": {
              "additionalProperties": false,
              "properties": {
                "label": {
                  "anyOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "runId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "socketPath": {
                  "type": "string"
                },
                "transport": {
                  "const": "stdio",
                  "type": "string"
                }
              },
              "required": [
                "runId",
                "label",
                "transport",
                "socketPath"
              ],
              "type": "object"
            },
            "daemon": {
              "additionalProperties": false,
              "properties": {
                "available": {
                  "type": "boolean"
                },
                "compatible": {
                  "type": "boolean"
                },
                "health": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "capabilities": {
                          "items": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "readOnly": true,
                          "type": "array"
                        },
                        "mode": {
                          "enum": [
                            "manual",
                            "supervised"
                          ],
                          "type": "string"
                        },
                        "pid": {
                          "exclusiveMinimum": 0,
                          "maximum": 9007199254740991,
                          "type": "integer"
                        },
                        "protocol": {
                          "additionalProperties": false,
                          "properties": {
                            "maximum": {
                              "exclusiveMinimum": 0,
                              "maximum": 9007199254740991,
                              "type": "integer"
                            },
                            "minimum": {
                              "exclusiveMinimum": 0,
                              "maximum": 9007199254740991,
                              "type": "integer"
                            }
                          },
                          "required": [
                            "minimum",
                            "maximum"
                          ],
                          "type": "object"
                        },
                        "softwareVersion": {
                          "minLength": 1,
                          "type": "string"
                        }
                      },
                      "required": [
                        "softwareVersion",
                        "protocol",
                        "capabilities",
                        "pid",
                        "mode"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "available",
                "compatible",
                "health"
              ],
              "type": "object"
            },
            "error": {
              "additionalProperties": false,
              "properties": {
                "code": {
                  "type": "string"
                },
                "details": {
                  "additionalProperties": {},
                  "propertyNames": {
                    "type": "string"
                  },
                  "type": "object"
                },
                "message": {
                  "type": "string"
                },
                "retryable": {
                  "type": "boolean"
                }
              },
              "required": [
                "code",
                "message",
                "retryable",
                "details"
              ],
              "type": "object"
            },
            "guidance": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "bridge",
            "daemon",
            "guidance"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_diagnostics`

Report bridge identity plus current daemon availability and compatibility.

- **Title:** PortReeve diagnostics
- **Family:** diagnostics
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_diagnostics`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {},
  "type": "object"
}
```

#### Structured output schema for `portreeve_diagnostics`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "bridge": {
              "additionalProperties": false,
              "properties": {
                "label": {
                  "anyOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "runId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "socketPath": {
                  "type": "string"
                },
                "transport": {
                  "const": "stdio",
                  "type": "string"
                }
              },
              "required": [
                "runId",
                "label",
                "transport",
                "socketPath"
              ],
              "type": "object"
            },
            "daemon": {
              "additionalProperties": false,
              "properties": {
                "available": {
                  "type": "boolean"
                },
                "compatible": {
                  "type": "boolean"
                },
                "health": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "capabilities": {
                          "items": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "readOnly": true,
                          "type": "array"
                        },
                        "mode": {
                          "enum": [
                            "manual",
                            "supervised"
                          ],
                          "type": "string"
                        },
                        "pid": {
                          "exclusiveMinimum": 0,
                          "maximum": 9007199254740991,
                          "type": "integer"
                        },
                        "protocol": {
                          "additionalProperties": false,
                          "properties": {
                            "maximum": {
                              "exclusiveMinimum": 0,
                              "maximum": 9007199254740991,
                              "type": "integer"
                            },
                            "minimum": {
                              "exclusiveMinimum": 0,
                              "maximum": 9007199254740991,
                              "type": "integer"
                            }
                          },
                          "required": [
                            "minimum",
                            "maximum"
                          ],
                          "type": "object"
                        },
                        "softwareVersion": {
                          "minLength": 1,
                          "type": "string"
                        }
                      },
                      "required": [
                        "softwareVersion",
                        "protocol",
                        "capabilities",
                        "pid",
                        "mode"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "available",
                "compatible",
                "health"
              ],
              "type": "object"
            },
            "error": {
              "additionalProperties": false,
              "properties": {
                "code": {
                  "type": "string"
                },
                "details": {
                  "additionalProperties": {},
                  "propertyNames": {
                    "type": "string"
                  },
                  "type": "object"
                },
                "message": {
                  "type": "string"
                },
                "retryable": {
                  "type": "boolean"
                }
              },
              "required": [
                "code",
                "message",
                "retryable",
                "details"
              ],
              "type": "object"
            },
            "guidance": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "bridge",
            "daemon",
            "guidance"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_settings_get`

Read the current global daemon settings.

- **Title:** Get PortReeve settings
- **Family:** settings
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_settings_get`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {},
  "type": "object"
}
```

#### Structured output schema for `portreeve_settings_get`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "automaticPortRanges": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "end": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  },
                  "start": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  }
                },
                "required": [
                  "start",
                  "end"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "diagnosticLogFiles": {
              "maximum": 9007199254740991,
              "minimum": -9007199254740991,
              "type": "integer"
            },
            "diagnosticLogMaximumBytes": {
              "maximum": 9007199254740991,
              "minimum": -9007199254740991,
              "type": "integer"
            },
            "ephemeralAssignmentTtlMilliseconds": {
              "maximum": 9007199254740991,
              "minimum": -9007199254740991,
              "type": "integer"
            },
            "excludedPorts": {
              "items": {
                "maximum": 65535,
                "minimum": 1,
                "type": "integer"
              },
              "type": "array"
            },
            "gracefulShutdownMilliseconds": {
              "maximum": 9007199254740991,
              "minimum": -9007199254740991,
              "type": "integer"
            },
            "historyMaximumEvents": {
              "maximum": 9007199254740991,
              "minimum": -9007199254740991,
              "type": "integer"
            },
            "leaseTtlMilliseconds": {
              "maximum": 9007199254740991,
              "minimum": -9007199254740991,
              "type": "integer"
            }
          },
          "required": [
            "automaticPortRanges",
            "excludedPorts",
            "leaseTtlMilliseconds",
            "ephemeralAssignmentTtlMilliseconds",
            "gracefulShutdownMilliseconds",
            "historyMaximumEvents",
            "diagnosticLogMaximumBytes",
            "diagnosticLogFiles"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_ports_list`

List globally observed development ports with explicit filters.

- **Title:** List ports
- **Family:** ports
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_ports_list`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "afterCursor": {
      "minLength": 1,
      "type": "string"
    },
    "claimed": {
      "type": "boolean"
    },
    "classification": {
      "enum": [
        "available",
        "verified",
        "idle",
        "pending",
        "unclaimed",
        "conflicting",
        "mixed",
        "docker-managed"
      ],
      "type": "string"
    },
    "component": {
      "type": "string"
    },
    "endpoint": {
      "type": "string"
    },
    "limit": {
      "default": 50,
      "maximum": 200,
      "minimum": 1,
      "type": "integer"
    },
    "listening": {
      "type": "boolean"
    },
    "port": {
      "maximum": 65535,
      "minimum": 1,
      "type": "integer"
    },
    "project": {
      "type": "string"
    },
    "workspace": {
      "type": "string"
    }
  },
  "required": [
    "limit"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_ports_list`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "items": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "claim": {
                    "anyOf": [
                      {
                        "additionalProperties": {},
                        "propertyNames": {
                          "type": "string"
                        },
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "classification": {
                    "enum": [
                      "available",
                      "verified",
                      "idle",
                      "pending",
                      "unclaimed",
                      "conflicting",
                      "mixed",
                      "docker-managed"
                    ],
                    "type": "string"
                  },
                  "docker": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "available": {
                            "type": "boolean"
                          },
                          "containers": {
                            "items": {
                              "additionalProperties": false,
                              "properties": {
                                "id": {
                                  "type": "string"
                                },
                                "labels": {
                                  "additionalProperties": {
                                    "type": "string"
                                  },
                                  "propertyNames": {
                                    "type": "string"
                                  },
                                  "type": "object"
                                },
                                "ports": {
                                  "items": {
                                    "additionalProperties": false,
                                    "properties": {
                                      "containerPort": {
                                        "maximum": 65535,
                                        "minimum": 1,
                                        "type": "integer"
                                      },
                                      "hostIp": {
                                        "type": "string"
                                      },
                                      "hostPort": {
                                        "maximum": 65535,
                                        "minimum": 1,
                                        "type": "integer"
                                      }
                                    },
                                    "required": [
                                      "containerPort",
                                      "hostIp",
                                      "hostPort"
                                    ],
                                    "type": "object"
                                  },
                                  "type": "array"
                                },
                                "running": {
                                  "type": "boolean"
                                }
                              },
                              "required": [
                                "id",
                                "running",
                                "labels",
                                "ports"
                              ],
                              "type": "object"
                            },
                            "type": "array"
                          },
                          "reason": {
                            "anyOf": [
                              {
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          }
                        },
                        "required": [
                          "available",
                          "reason",
                          "containers"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "lease": {
                    "anyOf": [
                      {
                        "additionalProperties": {},
                        "propertyNames": {
                          "type": "string"
                        },
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "listeners": {
                    "items": {
                      "additionalProperties": false,
                      "properties": {
                        "command": {
                          "anyOf": [
                            {
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "names": {
                          "items": {
                            "type": "string"
                          },
                          "type": "array"
                        },
                        "ownership": {
                          "additionalProperties": false,
                          "properties": {
                            "lineage": {
                              "items": {
                                "exclusiveMinimum": 0,
                                "maximum": 9007199254740991,
                                "type": "integer"
                              },
                              "type": "array"
                            },
                            "reason": {
                              "minLength": 1,
                              "type": "string"
                            },
                            "verified": {
                              "type": "boolean"
                            }
                          },
                          "required": [
                            "verified",
                            "reason",
                            "lineage"
                          ],
                          "type": "object"
                        },
                        "pid": {
                          "exclusiveMinimum": 0,
                          "maximum": 9007199254740991,
                          "type": "integer"
                        },
                        "port": {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        "process": {
                          "anyOf": [
                            {
                              "additionalProperties": {},
                              "propertyNames": {
                                "type": "string"
                              },
                              "type": "object"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        }
                      },
                      "required": [
                        "pid",
                        "port",
                        "command",
                        "names",
                        "process",
                        "ownership"
                      ],
                      "type": "object"
                    },
                    "type": "array"
                  },
                  "port": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  },
                  "run": {
                    "anyOf": [
                      {
                        "additionalProperties": {},
                        "propertyNames": {
                          "type": "string"
                        },
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "transport": {
                    "const": "tcp",
                    "type": "string"
                  }
                },
                "required": [
                  "port",
                  "transport",
                  "classification",
                  "claim",
                  "lease",
                  "run",
                  "docker",
                  "listeners"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "page": {
              "additionalProperties": false,
              "properties": {
                "nextCursor": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "nextCursor"
              ],
              "type": "object"
            }
          },
          "required": [
            "items",
            "page"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_port_inspect`

Inspect durable and live evidence for one exact TCP port.

- **Title:** Inspect a port
- **Family:** ports
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_port_inspect`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "port": {
      "maximum": 65535,
      "minimum": 1,
      "type": "integer"
    }
  },
  "required": [
    "port"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_port_inspect`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "claim": {
              "anyOf": [
                {
                  "additionalProperties": {},
                  "propertyNames": {
                    "type": "string"
                  },
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "classification": {
              "enum": [
                "available",
                "verified",
                "idle",
                "pending",
                "unclaimed",
                "conflicting",
                "mixed",
                "docker-managed"
              ],
              "type": "string"
            },
            "docker": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "available": {
                      "type": "boolean"
                    },
                    "containers": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "labels": {
                            "additionalProperties": {
                              "type": "string"
                            },
                            "propertyNames": {
                              "type": "string"
                            },
                            "type": "object"
                          },
                          "ports": {
                            "items": {
                              "additionalProperties": false,
                              "properties": {
                                "containerPort": {
                                  "maximum": 65535,
                                  "minimum": 1,
                                  "type": "integer"
                                },
                                "hostIp": {
                                  "type": "string"
                                },
                                "hostPort": {
                                  "maximum": 65535,
                                  "minimum": 1,
                                  "type": "integer"
                                }
                              },
                              "required": [
                                "containerPort",
                                "hostIp",
                                "hostPort"
                              ],
                              "type": "object"
                            },
                            "type": "array"
                          },
                          "running": {
                            "type": "boolean"
                          }
                        },
                        "required": [
                          "id",
                          "running",
                          "labels",
                          "ports"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "reason": {
                      "anyOf": [
                        {
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    }
                  },
                  "required": [
                    "available",
                    "reason",
                    "containers"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "lease": {
              "anyOf": [
                {
                  "additionalProperties": {},
                  "propertyNames": {
                    "type": "string"
                  },
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "listeners": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "command": {
                    "anyOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "names": {
                    "items": {
                      "type": "string"
                    },
                    "type": "array"
                  },
                  "ownership": {
                    "additionalProperties": false,
                    "properties": {
                      "lineage": {
                        "items": {
                          "exclusiveMinimum": 0,
                          "maximum": 9007199254740991,
                          "type": "integer"
                        },
                        "type": "array"
                      },
                      "reason": {
                        "minLength": 1,
                        "type": "string"
                      },
                      "verified": {
                        "type": "boolean"
                      }
                    },
                    "required": [
                      "verified",
                      "reason",
                      "lineage"
                    ],
                    "type": "object"
                  },
                  "pid": {
                    "exclusiveMinimum": 0,
                    "maximum": 9007199254740991,
                    "type": "integer"
                  },
                  "port": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  },
                  "process": {
                    "anyOf": [
                      {
                        "additionalProperties": {},
                        "propertyNames": {
                          "type": "string"
                        },
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  }
                },
                "required": [
                  "pid",
                  "port",
                  "command",
                  "names",
                  "process",
                  "ownership"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "port": {
              "maximum": 65535,
              "minimum": 1,
              "type": "integer"
            },
            "run": {
              "anyOf": [
                {
                  "additionalProperties": {},
                  "propertyNames": {
                    "type": "string"
                  },
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "transport": {
              "const": "tcp",
              "type": "string"
            }
          },
          "required": [
            "port",
            "transport",
            "classification",
            "claim",
            "lease",
            "run",
            "docker",
            "listeners"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_port_reclaim_preview`

Inspect current ownership and listener evidence and issue a five-minute receipt for one normal PortReeve-owned reclaim.

- **Title:** Preview port reclaim
- **Family:** ports
- **Safety:** mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_port_reclaim_preview`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "policy": {
      "enum": [
        "never",
        "graceful",
        "force-after-grace"
      ],
      "type": "string"
    },
    "port": {
      "maximum": 65535,
      "minimum": 1,
      "type": "integer"
    }
  },
  "required": [
    "port",
    "policy"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_port_reclaim_preview`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "action": {
              "const": "port.reclaim",
              "type": "string"
            },
            "expiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "observed": {
              "additionalProperties": false,
              "properties": {
                "inventory": {
                  "additionalProperties": false,
                  "properties": {
                    "claim": {
                      "anyOf": [
                        {
                          "additionalProperties": {},
                          "propertyNames": {
                            "type": "string"
                          },
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "classification": {
                      "enum": [
                        "available",
                        "verified",
                        "idle",
                        "pending",
                        "unclaimed",
                        "conflicting",
                        "mixed",
                        "docker-managed"
                      ],
                      "type": "string"
                    },
                    "docker": {
                      "anyOf": [
                        {
                          "additionalProperties": false,
                          "properties": {
                            "available": {
                              "type": "boolean"
                            },
                            "containers": {
                              "items": {
                                "additionalProperties": false,
                                "properties": {
                                  "id": {
                                    "type": "string"
                                  },
                                  "labels": {
                                    "additionalProperties": {
                                      "type": "string"
                                    },
                                    "propertyNames": {
                                      "type": "string"
                                    },
                                    "type": "object"
                                  },
                                  "ports": {
                                    "items": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "containerPort": {
                                          "maximum": 65535,
                                          "minimum": 1,
                                          "type": "integer"
                                        },
                                        "hostIp": {
                                          "type": "string"
                                        },
                                        "hostPort": {
                                          "maximum": 65535,
                                          "minimum": 1,
                                          "type": "integer"
                                        }
                                      },
                                      "required": [
                                        "containerPort",
                                        "hostIp",
                                        "hostPort"
                                      ],
                                      "type": "object"
                                    },
                                    "type": "array"
                                  },
                                  "running": {
                                    "type": "boolean"
                                  }
                                },
                                "required": [
                                  "id",
                                  "running",
                                  "labels",
                                  "ports"
                                ],
                                "type": "object"
                              },
                              "type": "array"
                            },
                            "reason": {
                              "anyOf": [
                                {
                                  "type": "string"
                                },
                                {
                                  "type": "null"
                                }
                              ]
                            }
                          },
                          "required": [
                            "available",
                            "reason",
                            "containers"
                          ],
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "lease": {
                      "anyOf": [
                        {
                          "additionalProperties": {},
                          "propertyNames": {
                            "type": "string"
                          },
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "listeners": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "command": {
                            "anyOf": [
                              {
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "names": {
                            "items": {
                              "type": "string"
                            },
                            "type": "array"
                          },
                          "ownership": {
                            "additionalProperties": false,
                            "properties": {
                              "lineage": {
                                "items": {
                                  "exclusiveMinimum": 0,
                                  "maximum": 9007199254740991,
                                  "type": "integer"
                                },
                                "type": "array"
                              },
                              "reason": {
                                "minLength": 1,
                                "type": "string"
                              },
                              "verified": {
                                "type": "boolean"
                              }
                            },
                            "required": [
                              "verified",
                              "reason",
                              "lineage"
                            ],
                            "type": "object"
                          },
                          "pid": {
                            "exclusiveMinimum": 0,
                            "maximum": 9007199254740991,
                            "type": "integer"
                          },
                          "port": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "process": {
                            "anyOf": [
                              {
                                "additionalProperties": {},
                                "propertyNames": {
                                  "type": "string"
                                },
                                "type": "object"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          }
                        },
                        "required": [
                          "pid",
                          "port",
                          "command",
                          "names",
                          "process",
                          "ownership"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "port": {
                      "maximum": 65535,
                      "minimum": 1,
                      "type": "integer"
                    },
                    "run": {
                      "anyOf": [
                        {
                          "additionalProperties": {},
                          "propertyNames": {
                            "type": "string"
                          },
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "transport": {
                      "const": "tcp",
                      "type": "string"
                    }
                  },
                  "required": [
                    "port",
                    "transport",
                    "classification",
                    "claim",
                    "lease",
                    "run",
                    "docker",
                    "listeners"
                  ],
                  "type": "object"
                },
                "launcherAction": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "action": {
                          "const": "stop-container",
                          "type": "string"
                        },
                        "containerIds": {
                          "items": {
                            "pattern": "^[a-f0-9]{12,64}$",
                            "type": "string"
                          },
                          "minItems": 1,
                          "type": "array"
                        },
                        "kind": {
                          "const": "docker",
                          "type": "string"
                        }
                      },
                      "required": [
                        "kind",
                        "action",
                        "containerIds"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "outcome": {
                  "enum": [
                    "already-free",
                    "would-terminate",
                    "terminated",
                    "refused",
                    "timeout",
                    "launcher-action-required"
                  ],
                  "type": "string"
                },
                "policy": {
                  "enum": [
                    "never",
                    "graceful",
                    "force-after-grace"
                  ],
                  "type": "string"
                },
                "port": {
                  "maximum": 65535,
                  "minimum": 1,
                  "type": "integer"
                },
                "reason": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "targets": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "command": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "names": {
                        "items": {
                          "type": "string"
                        },
                        "type": "array"
                      },
                      "ownership": {
                        "additionalProperties": false,
                        "properties": {
                          "lineage": {
                            "items": {
                              "exclusiveMinimum": 0,
                              "maximum": 9007199254740991,
                              "type": "integer"
                            },
                            "type": "array"
                          },
                          "reason": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "verified": {
                            "type": "boolean"
                          }
                        },
                        "required": [
                          "verified",
                          "reason",
                          "lineage"
                        ],
                        "type": "object"
                      },
                      "pid": {
                        "exclusiveMinimum": 0,
                        "maximum": 9007199254740991,
                        "type": "integer"
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "process": {
                        "anyOf": [
                          {
                            "additionalProperties": {},
                            "propertyNames": {
                              "type": "string"
                            },
                            "type": "object"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      }
                    },
                    "required": [
                      "pid",
                      "port",
                      "command",
                      "names",
                      "process",
                      "ownership"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                }
              },
              "required": [
                "port",
                "policy",
                "outcome",
                "reason",
                "launcherAction",
                "targets",
                "inventory"
              ],
              "type": "object"
            },
            "proposal": {
              "additionalProperties": false,
              "properties": {
                "policy": {
                  "enum": [
                    "never",
                    "graceful",
                    "force-after-grace"
                  ],
                  "type": "string"
                }
              },
              "required": [
                "policy"
              ],
              "type": "object"
            },
            "receiptId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "target": {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "minLength": 1,
                  "type": "string"
                },
                "type": {
                  "const": "port",
                  "type": "string"
                }
              },
              "required": [
                "type",
                "id"
              ],
              "type": "object"
            }
          },
          "required": [
            "receiptId",
            "action",
            "target",
            "proposal",
            "observed",
            "expiresAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_port_reclaim_execute`

Execute a normal reclaim only when the exact port evidence still matches its receipt. Unsafe any-owner eviction is not available.

- **Title:** Execute port reclaim
- **Family:** ports
- **Safety:** consequential-mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive yes; idempotent yes; open-world no

#### Input schema for `portreeve_port_reclaim_execute`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "port": {
      "maximum": 65535,
      "minimum": 1,
      "type": "integer"
    },
    "receiptId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "receiptId",
    "port"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_port_reclaim_execute`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "replayed": {
              "type": "boolean"
            },
            "result": {
              "additionalProperties": false,
              "properties": {
                "dryRun": {
                  "type": "boolean"
                },
                "launcherAction": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "action": {
                          "const": "stop-container",
                          "type": "string"
                        },
                        "containerIds": {
                          "items": {
                            "pattern": "^[a-f0-9]{12,64}$",
                            "type": "string"
                          },
                          "minItems": 1,
                          "type": "array"
                        },
                        "kind": {
                          "const": "docker",
                          "type": "string"
                        }
                      },
                      "required": [
                        "kind",
                        "action",
                        "containerIds"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "operation": {
                  "enum": [
                    "reclaim",
                    "unsafe-eviction"
                  ],
                  "type": "string"
                },
                "operationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "outcome": {
                  "enum": [
                    "already-free",
                    "would-terminate",
                    "terminated",
                    "refused",
                    "timeout",
                    "launcher-action-required"
                  ],
                  "type": "string"
                },
                "policy": {
                  "enum": [
                    "never",
                    "graceful",
                    "force-after-grace"
                  ],
                  "type": "string"
                },
                "port": {
                  "maximum": 65535,
                  "minimum": 1,
                  "type": "integer"
                },
                "reason": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "signals": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "at": {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      },
                      "pid": {
                        "exclusiveMinimum": 0,
                        "maximum": 9007199254740991,
                        "type": "integer"
                      },
                      "signal": {
                        "enum": [
                          "SIGTERM",
                          "SIGKILL"
                        ],
                        "type": "string"
                      }
                    },
                    "required": [
                      "pid",
                      "signal",
                      "at"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "targets": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "command": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "names": {
                        "items": {
                          "type": "string"
                        },
                        "type": "array"
                      },
                      "ownership": {
                        "additionalProperties": false,
                        "properties": {
                          "lineage": {
                            "items": {
                              "exclusiveMinimum": 0,
                              "maximum": 9007199254740991,
                              "type": "integer"
                            },
                            "type": "array"
                          },
                          "reason": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "verified": {
                            "type": "boolean"
                          }
                        },
                        "required": [
                          "verified",
                          "reason",
                          "lineage"
                        ],
                        "type": "object"
                      },
                      "pid": {
                        "exclusiveMinimum": 0,
                        "maximum": 9007199254740991,
                        "type": "integer"
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "process": {
                        "anyOf": [
                          {
                            "additionalProperties": {},
                            "propertyNames": {
                              "type": "string"
                            },
                            "type": "object"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      }
                    },
                    "required": [
                      "pid",
                      "port",
                      "command",
                      "names",
                      "process",
                      "ownership"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                }
              },
              "required": [
                "operationId",
                "operation",
                "port",
                "policy",
                "dryRun",
                "outcome",
                "reason",
                "launcherAction",
                "targets",
                "signals"
              ],
              "type": "object"
            }
          },
          "required": [
            "changed",
            "replayed",
            "result"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_claims_list`

List durable claims globally with explicit identity filters.

- **Title:** List claims
- **Family:** claims
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_claims_list`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "afterCursor": {
      "minLength": 1,
      "type": "string"
    },
    "component": {
      "type": "string"
    },
    "endpoint": {
      "type": "string"
    },
    "limit": {
      "default": 50,
      "maximum": 200,
      "minimum": 1,
      "type": "integer"
    },
    "project": {
      "type": "string"
    },
    "workspaceRoot": {
      "type": "string"
    }
  },
  "required": [
    "limit"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_claims_list`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "items": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "assignedPort": {
                    "anyOf": [
                      {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "assignmentExpiresAt": {
                    "anyOf": [
                      {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "createdAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "exactPort": {
                    "anyOf": [
                      {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "id": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "identity": {
                    "additionalProperties": false,
                    "properties": {
                      "component": {
                        "type": "string"
                      },
                      "endpoint": {
                        "type": "string"
                      },
                      "project": {
                        "type": "string"
                      },
                      "service": {
                        "type": "string"
                      },
                      "transport": {
                        "const": "tcp",
                        "type": "string"
                      },
                      "workspaceRoot": {
                        "type": "string"
                      }
                    },
                    "required": [
                      "project",
                      "workspaceRoot",
                      "service",
                      "component",
                      "endpoint",
                      "transport"
                    ],
                    "type": "object"
                  },
                  "lastUsedAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "mode": {
                    "enum": [
                      "sticky",
                      "ephemeral"
                    ],
                    "type": "string"
                  },
                  "preferredPort": {
                    "anyOf": [
                      {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "updatedAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "identity",
                  "mode",
                  "assignedPort",
                  "preferredPort",
                  "exactPort",
                  "assignmentExpiresAt",
                  "createdAt",
                  "updatedAt",
                  "lastUsedAt"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "page": {
              "additionalProperties": false,
              "properties": {
                "nextCursor": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "nextCursor"
              ],
              "type": "object"
            }
          },
          "required": [
            "items",
            "page"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_claim_get`

Read one durable claim by explicit identifier.

- **Title:** Get a claim
- **Family:** claims
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_claim_get`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "id": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "id"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_claim_get`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "assignedPort": {
              "anyOf": [
                {
                  "maximum": 65535,
                  "minimum": 1,
                  "type": "integer"
                },
                {
                  "type": "null"
                }
              ]
            },
            "assignmentExpiresAt": {
              "anyOf": [
                {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "createdAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "exactPort": {
              "anyOf": [
                {
                  "maximum": 65535,
                  "minimum": 1,
                  "type": "integer"
                },
                {
                  "type": "null"
                }
              ]
            },
            "id": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "identity": {
              "additionalProperties": false,
              "properties": {
                "component": {
                  "type": "string"
                },
                "endpoint": {
                  "type": "string"
                },
                "project": {
                  "type": "string"
                },
                "service": {
                  "type": "string"
                },
                "transport": {
                  "const": "tcp",
                  "type": "string"
                },
                "workspaceRoot": {
                  "type": "string"
                }
              },
              "required": [
                "project",
                "workspaceRoot",
                "service",
                "component",
                "endpoint",
                "transport"
              ],
              "type": "object"
            },
            "lastUsedAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "mode": {
              "enum": [
                "sticky",
                "ephemeral"
              ],
              "type": "string"
            },
            "preferredPort": {
              "anyOf": [
                {
                  "maximum": 65535,
                  "minimum": 1,
                  "type": "integer"
                },
                {
                  "type": "null"
                }
              ]
            },
            "updatedAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            }
          },
          "required": [
            "id",
            "identity",
            "mode",
            "assignedPort",
            "preferredPort",
            "exactPort",
            "assignmentExpiresAt",
            "createdAt",
            "updatedAt",
            "lastUsedAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_claim_reassign_preview`

Choose and inspect a currently idle replacement port for one explicit claim, then issue a five-minute receipt.

- **Title:** Preview claim reassignment
- **Family:** claims
- **Safety:** mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_claim_reassign_preview`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "claimId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "exactPort": {
      "maximum": 65535,
      "minimum": 1,
      "type": "integer"
    },
    "preferredPort": {
      "maximum": 65535,
      "minimum": 1,
      "type": "integer"
    }
  },
  "required": [
    "claimId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_claim_reassign_preview`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "action": {
              "const": "claim.reassign",
              "type": "string"
            },
            "expiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "observed": {
              "additionalProperties": false,
              "properties": {
                "claim": {
                  "additionalProperties": false,
                  "properties": {
                    "assignedPort": {
                      "anyOf": [
                        {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "assignmentExpiresAt": {
                      "anyOf": [
                        {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "createdAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    "exactPort": {
                      "anyOf": [
                        {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "id": {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    "identity": {
                      "additionalProperties": false,
                      "properties": {
                        "component": {
                          "type": "string"
                        },
                        "endpoint": {
                          "type": "string"
                        },
                        "project": {
                          "type": "string"
                        },
                        "service": {
                          "type": "string"
                        },
                        "transport": {
                          "const": "tcp",
                          "type": "string"
                        },
                        "workspaceRoot": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "project",
                        "workspaceRoot",
                        "service",
                        "component",
                        "endpoint",
                        "transport"
                      ],
                      "type": "object"
                    },
                    "lastUsedAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    "mode": {
                      "enum": [
                        "sticky",
                        "ephemeral"
                      ],
                      "type": "string"
                    },
                    "preferredPort": {
                      "anyOf": [
                        {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "updatedAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    }
                  },
                  "required": [
                    "id",
                    "identity",
                    "mode",
                    "assignedPort",
                    "preferredPort",
                    "exactPort",
                    "assignmentExpiresAt",
                    "createdAt",
                    "updatedAt",
                    "lastUsedAt"
                  ],
                  "type": "object"
                },
                "exactPort": {
                  "anyOf": [
                    {
                      "maximum": 65535,
                      "minimum": 1,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "inventory": {
                  "additionalProperties": false,
                  "properties": {
                    "claim": {
                      "anyOf": [
                        {
                          "additionalProperties": {},
                          "propertyNames": {
                            "type": "string"
                          },
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "classification": {
                      "enum": [
                        "available",
                        "verified",
                        "idle",
                        "pending",
                        "unclaimed",
                        "conflicting",
                        "mixed",
                        "docker-managed"
                      ],
                      "type": "string"
                    },
                    "docker": {
                      "anyOf": [
                        {
                          "additionalProperties": false,
                          "properties": {
                            "available": {
                              "type": "boolean"
                            },
                            "containers": {
                              "items": {
                                "additionalProperties": false,
                                "properties": {
                                  "id": {
                                    "type": "string"
                                  },
                                  "labels": {
                                    "additionalProperties": {
                                      "type": "string"
                                    },
                                    "propertyNames": {
                                      "type": "string"
                                    },
                                    "type": "object"
                                  },
                                  "ports": {
                                    "items": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "containerPort": {
                                          "maximum": 65535,
                                          "minimum": 1,
                                          "type": "integer"
                                        },
                                        "hostIp": {
                                          "type": "string"
                                        },
                                        "hostPort": {
                                          "maximum": 65535,
                                          "minimum": 1,
                                          "type": "integer"
                                        }
                                      },
                                      "required": [
                                        "containerPort",
                                        "hostIp",
                                        "hostPort"
                                      ],
                                      "type": "object"
                                    },
                                    "type": "array"
                                  },
                                  "running": {
                                    "type": "boolean"
                                  }
                                },
                                "required": [
                                  "id",
                                  "running",
                                  "labels",
                                  "ports"
                                ],
                                "type": "object"
                              },
                              "type": "array"
                            },
                            "reason": {
                              "anyOf": [
                                {
                                  "type": "string"
                                },
                                {
                                  "type": "null"
                                }
                              ]
                            }
                          },
                          "required": [
                            "available",
                            "reason",
                            "containers"
                          ],
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "lease": {
                      "anyOf": [
                        {
                          "additionalProperties": {},
                          "propertyNames": {
                            "type": "string"
                          },
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "listeners": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "command": {
                            "anyOf": [
                              {
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "names": {
                            "items": {
                              "type": "string"
                            },
                            "type": "array"
                          },
                          "ownership": {
                            "additionalProperties": false,
                            "properties": {
                              "lineage": {
                                "items": {
                                  "exclusiveMinimum": 0,
                                  "maximum": 9007199254740991,
                                  "type": "integer"
                                },
                                "type": "array"
                              },
                              "reason": {
                                "minLength": 1,
                                "type": "string"
                              },
                              "verified": {
                                "type": "boolean"
                              }
                            },
                            "required": [
                              "verified",
                              "reason",
                              "lineage"
                            ],
                            "type": "object"
                          },
                          "pid": {
                            "exclusiveMinimum": 0,
                            "maximum": 9007199254740991,
                            "type": "integer"
                          },
                          "port": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "process": {
                            "anyOf": [
                              {
                                "additionalProperties": {},
                                "propertyNames": {
                                  "type": "string"
                                },
                                "type": "object"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          }
                        },
                        "required": [
                          "pid",
                          "port",
                          "command",
                          "names",
                          "process",
                          "ownership"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "port": {
                      "maximum": 65535,
                      "minimum": 1,
                      "type": "integer"
                    },
                    "run": {
                      "anyOf": [
                        {
                          "additionalProperties": {},
                          "propertyNames": {
                            "type": "string"
                          },
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "transport": {
                      "const": "tcp",
                      "type": "string"
                    }
                  },
                  "required": [
                    "port",
                    "transport",
                    "classification",
                    "claim",
                    "lease",
                    "run",
                    "docker",
                    "listeners"
                  ],
                  "type": "object"
                },
                "port": {
                  "maximum": 65535,
                  "minimum": 1,
                  "type": "integer"
                },
                "preferredPort": {
                  "anyOf": [
                    {
                      "maximum": 65535,
                      "minimum": 1,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "claim",
                "port",
                "preferredPort",
                "exactPort",
                "inventory"
              ],
              "type": "object"
            },
            "proposal": {
              "additionalProperties": false,
              "properties": {
                "exactPort": {
                  "maximum": 65535,
                  "minimum": 1,
                  "type": "integer"
                },
                "preferredPort": {
                  "maximum": 65535,
                  "minimum": 1,
                  "type": "integer"
                }
              },
              "type": "object"
            },
            "receiptId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "target": {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "minLength": 1,
                  "type": "string"
                },
                "type": {
                  "const": "claim",
                  "type": "string"
                }
              },
              "required": [
                "type",
                "id"
              ],
              "type": "object"
            }
          },
          "required": [
            "receiptId",
            "action",
            "target",
            "proposal",
            "observed",
            "expiresAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_claim_reassign_execute`

Reassign one explicit claim only when its idle state and selected-port evidence still match the receipt.

- **Title:** Execute claim reassignment
- **Family:** claims
- **Safety:** consequential-mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive yes; idempotent yes; open-world no

#### Input schema for `portreeve_claim_reassign_execute`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "claimId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "receiptId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "receiptId",
    "claimId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_claim_reassign_execute`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "replayed": {
              "type": "boolean"
            },
            "result": {
              "additionalProperties": false,
              "properties": {
                "assignedPort": {
                  "anyOf": [
                    {
                      "maximum": 65535,
                      "minimum": 1,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "assignmentExpiresAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "exactPort": {
                  "anyOf": [
                    {
                      "maximum": 65535,
                      "minimum": 1,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "identity": {
                  "additionalProperties": false,
                  "properties": {
                    "component": {
                      "type": "string"
                    },
                    "endpoint": {
                      "type": "string"
                    },
                    "project": {
                      "type": "string"
                    },
                    "service": {
                      "type": "string"
                    },
                    "transport": {
                      "const": "tcp",
                      "type": "string"
                    },
                    "workspaceRoot": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "project",
                    "workspaceRoot",
                    "service",
                    "component",
                    "endpoint",
                    "transport"
                  ],
                  "type": "object"
                },
                "lastUsedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "mode": {
                  "enum": [
                    "sticky",
                    "ephemeral"
                  ],
                  "type": "string"
                },
                "preferredPort": {
                  "anyOf": [
                    {
                      "maximum": 65535,
                      "minimum": 1,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "updatedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "identity",
                "mode",
                "assignedPort",
                "preferredPort",
                "exactPort",
                "assignmentExpiresAt",
                "createdAt",
                "updatedAt",
                "lastUsedAt"
              ],
              "type": "object"
            }
          },
          "required": [
            "changed",
            "replayed",
            "result"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_claim_delete_preview`

Inspect one explicit idle claim and issue a five-minute deletion receipt.

- **Title:** Preview claim deletion
- **Family:** claims
- **Safety:** mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_claim_delete_preview`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "claimId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "claimId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_claim_delete_preview`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "action": {
              "const": "claim.delete",
              "type": "string"
            },
            "expiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "observed": {
              "additionalProperties": false,
              "properties": {
                "claim": {
                  "additionalProperties": false,
                  "properties": {
                    "assignedPort": {
                      "anyOf": [
                        {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "assignmentExpiresAt": {
                      "anyOf": [
                        {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "createdAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    "exactPort": {
                      "anyOf": [
                        {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "id": {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    "identity": {
                      "additionalProperties": false,
                      "properties": {
                        "component": {
                          "type": "string"
                        },
                        "endpoint": {
                          "type": "string"
                        },
                        "project": {
                          "type": "string"
                        },
                        "service": {
                          "type": "string"
                        },
                        "transport": {
                          "const": "tcp",
                          "type": "string"
                        },
                        "workspaceRoot": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "project",
                        "workspaceRoot",
                        "service",
                        "component",
                        "endpoint",
                        "transport"
                      ],
                      "type": "object"
                    },
                    "lastUsedAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    "mode": {
                      "enum": [
                        "sticky",
                        "ephemeral"
                      ],
                      "type": "string"
                    },
                    "preferredPort": {
                      "anyOf": [
                        {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "updatedAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    }
                  },
                  "required": [
                    "id",
                    "identity",
                    "mode",
                    "assignedPort",
                    "preferredPort",
                    "exactPort",
                    "assignmentExpiresAt",
                    "createdAt",
                    "updatedAt",
                    "lastUsedAt"
                  ],
                  "type": "object"
                },
                "inventory": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "claim": {
                          "anyOf": [
                            {
                              "additionalProperties": {},
                              "propertyNames": {
                                "type": "string"
                              },
                              "type": "object"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "classification": {
                          "enum": [
                            "available",
                            "verified",
                            "idle",
                            "pending",
                            "unclaimed",
                            "conflicting",
                            "mixed",
                            "docker-managed"
                          ],
                          "type": "string"
                        },
                        "docker": {
                          "anyOf": [
                            {
                              "additionalProperties": false,
                              "properties": {
                                "available": {
                                  "type": "boolean"
                                },
                                "containers": {
                                  "items": {
                                    "additionalProperties": false,
                                    "properties": {
                                      "id": {
                                        "type": "string"
                                      },
                                      "labels": {
                                        "additionalProperties": {
                                          "type": "string"
                                        },
                                        "propertyNames": {
                                          "type": "string"
                                        },
                                        "type": "object"
                                      },
                                      "ports": {
                                        "items": {
                                          "additionalProperties": false,
                                          "properties": {
                                            "containerPort": {
                                              "maximum": 65535,
                                              "minimum": 1,
                                              "type": "integer"
                                            },
                                            "hostIp": {
                                              "type": "string"
                                            },
                                            "hostPort": {
                                              "maximum": 65535,
                                              "minimum": 1,
                                              "type": "integer"
                                            }
                                          },
                                          "required": [
                                            "containerPort",
                                            "hostIp",
                                            "hostPort"
                                          ],
                                          "type": "object"
                                        },
                                        "type": "array"
                                      },
                                      "running": {
                                        "type": "boolean"
                                      }
                                    },
                                    "required": [
                                      "id",
                                      "running",
                                      "labels",
                                      "ports"
                                    ],
                                    "type": "object"
                                  },
                                  "type": "array"
                                },
                                "reason": {
                                  "anyOf": [
                                    {
                                      "type": "string"
                                    },
                                    {
                                      "type": "null"
                                    }
                                  ]
                                }
                              },
                              "required": [
                                "available",
                                "reason",
                                "containers"
                              ],
                              "type": "object"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "lease": {
                          "anyOf": [
                            {
                              "additionalProperties": {},
                              "propertyNames": {
                                "type": "string"
                              },
                              "type": "object"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "listeners": {
                          "items": {
                            "additionalProperties": false,
                            "properties": {
                              "command": {
                                "anyOf": [
                                  {
                                    "type": "string"
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              },
                              "names": {
                                "items": {
                                  "type": "string"
                                },
                                "type": "array"
                              },
                              "ownership": {
                                "additionalProperties": false,
                                "properties": {
                                  "lineage": {
                                    "items": {
                                      "exclusiveMinimum": 0,
                                      "maximum": 9007199254740991,
                                      "type": "integer"
                                    },
                                    "type": "array"
                                  },
                                  "reason": {
                                    "minLength": 1,
                                    "type": "string"
                                  },
                                  "verified": {
                                    "type": "boolean"
                                  }
                                },
                                "required": [
                                  "verified",
                                  "reason",
                                  "lineage"
                                ],
                                "type": "object"
                              },
                              "pid": {
                                "exclusiveMinimum": 0,
                                "maximum": 9007199254740991,
                                "type": "integer"
                              },
                              "port": {
                                "maximum": 65535,
                                "minimum": 1,
                                "type": "integer"
                              },
                              "process": {
                                "anyOf": [
                                  {
                                    "additionalProperties": {},
                                    "propertyNames": {
                                      "type": "string"
                                    },
                                    "type": "object"
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              }
                            },
                            "required": [
                              "pid",
                              "port",
                              "command",
                              "names",
                              "process",
                              "ownership"
                            ],
                            "type": "object"
                          },
                          "type": "array"
                        },
                        "port": {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        "run": {
                          "anyOf": [
                            {
                              "additionalProperties": {},
                              "propertyNames": {
                                "type": "string"
                              },
                              "type": "object"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "transport": {
                          "const": "tcp",
                          "type": "string"
                        }
                      },
                      "required": [
                        "port",
                        "transport",
                        "classification",
                        "claim",
                        "lease",
                        "run",
                        "docker",
                        "listeners"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "claim",
                "inventory"
              ],
              "type": "object"
            },
            "proposal": {
              "additionalProperties": false,
              "properties": {},
              "type": "object"
            },
            "receiptId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "target": {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "minLength": 1,
                  "type": "string"
                },
                "type": {
                  "const": "claim",
                  "type": "string"
                }
              },
              "required": [
                "type",
                "id"
              ],
              "type": "object"
            }
          },
          "required": [
            "receiptId",
            "action",
            "target",
            "proposal",
            "observed",
            "expiresAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_claim_delete_execute`

Delete one claim only while its evidence still matches the receipt.

- **Title:** Execute claim deletion
- **Family:** claims
- **Safety:** consequential-mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive yes; idempotent yes; open-world no

#### Input schema for `portreeve_claim_delete_execute`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "claimId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "receiptId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "receiptId",
    "claimId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_claim_delete_execute`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "replayed": {
              "type": "boolean"
            },
            "result": {
              "additionalProperties": false,
              "properties": {
                "claimId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "deleted": {
                  "type": "boolean"
                }
              },
              "required": [
                "deleted",
                "claimId"
              ],
              "type": "object"
            }
          },
          "required": [
            "changed",
            "replayed",
            "result"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_claims_prune_preview`

List missing-worktree claim candidates and blockers, then issue a five-minute global prune receipt.

- **Title:** Preview stale-claim pruning
- **Family:** claims
- **Safety:** mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_claims_prune_preview`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "olderThanMilliseconds": {
      "maximum": 315576000000,
      "minimum": 0,
      "type": "integer"
    }
  },
  "required": [
    "olderThanMilliseconds"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_claims_prune_preview`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "action": {
              "const": "claims.prune",
              "type": "string"
            },
            "expiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "observed": {
              "additionalProperties": false,
              "properties": {
                "candidates": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "claim": {
                        "additionalProperties": false,
                        "properties": {
                          "assignedPort": {
                            "anyOf": [
                              {
                                "maximum": 65535,
                                "minimum": 1,
                                "type": "integer"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "assignmentExpiresAt": {
                            "anyOf": [
                              {
                                "format": "date-time",
                                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "createdAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "exactPort": {
                            "anyOf": [
                              {
                                "maximum": 65535,
                                "minimum": 1,
                                "type": "integer"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "id": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          "identity": {
                            "additionalProperties": false,
                            "properties": {
                              "component": {
                                "type": "string"
                              },
                              "endpoint": {
                                "type": "string"
                              },
                              "project": {
                                "type": "string"
                              },
                              "service": {
                                "type": "string"
                              },
                              "transport": {
                                "const": "tcp",
                                "type": "string"
                              },
                              "workspaceRoot": {
                                "type": "string"
                              }
                            },
                            "required": [
                              "project",
                              "workspaceRoot",
                              "service",
                              "component",
                              "endpoint",
                              "transport"
                            ],
                            "type": "object"
                          },
                          "lastUsedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "mode": {
                            "enum": [
                              "sticky",
                              "ephemeral"
                            ],
                            "type": "string"
                          },
                          "preferredPort": {
                            "anyOf": [
                              {
                                "maximum": 65535,
                                "minimum": 1,
                                "type": "integer"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "updatedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "id",
                          "identity",
                          "mode",
                          "assignedPort",
                          "preferredPort",
                          "exactPort",
                          "assignmentExpiresAt",
                          "createdAt",
                          "updatedAt",
                          "lastUsedAt"
                        ],
                        "type": "object"
                      },
                      "reason": {
                        "const": "workspace-missing",
                        "type": "string"
                      }
                    },
                    "required": [
                      "claim",
                      "reason"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "deletedClaimIds": {
                  "items": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "type": "array"
                },
                "dryRun": {
                  "type": "boolean"
                },
                "skipped": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "reason": {
                        "minLength": 1,
                        "type": "string"
                      }
                    },
                    "required": [
                      "claimId",
                      "reason"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                }
              },
              "required": [
                "dryRun",
                "candidates",
                "deletedClaimIds",
                "skipped"
              ],
              "type": "object"
            },
            "proposal": {
              "additionalProperties": false,
              "properties": {
                "olderThanMilliseconds": {
                  "maximum": 315576000000,
                  "minimum": 0,
                  "type": "integer"
                }
              },
              "required": [
                "olderThanMilliseconds"
              ],
              "type": "object"
            },
            "receiptId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "target": {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "minLength": 1,
                  "type": "string"
                },
                "type": {
                  "const": "claim-collection",
                  "type": "string"
                }
              },
              "required": [
                "type",
                "id"
              ],
              "type": "object"
            }
          },
          "required": [
            "receiptId",
            "action",
            "target",
            "proposal",
            "observed",
            "expiresAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_claims_prune_execute`

Prune only the claim candidate set whose fresh evidence still matches the receipt.

- **Title:** Execute stale-claim pruning
- **Family:** claims
- **Safety:** consequential-mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive yes; idempotent yes; open-world no

#### Input schema for `portreeve_claims_prune_execute`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "receiptId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "receiptId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_claims_prune_execute`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "replayed": {
              "type": "boolean"
            },
            "result": {
              "additionalProperties": false,
              "properties": {
                "candidates": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "claim": {
                        "additionalProperties": false,
                        "properties": {
                          "assignedPort": {
                            "anyOf": [
                              {
                                "maximum": 65535,
                                "minimum": 1,
                                "type": "integer"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "assignmentExpiresAt": {
                            "anyOf": [
                              {
                                "format": "date-time",
                                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "createdAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "exactPort": {
                            "anyOf": [
                              {
                                "maximum": 65535,
                                "minimum": 1,
                                "type": "integer"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "id": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          "identity": {
                            "additionalProperties": false,
                            "properties": {
                              "component": {
                                "type": "string"
                              },
                              "endpoint": {
                                "type": "string"
                              },
                              "project": {
                                "type": "string"
                              },
                              "service": {
                                "type": "string"
                              },
                              "transport": {
                                "const": "tcp",
                                "type": "string"
                              },
                              "workspaceRoot": {
                                "type": "string"
                              }
                            },
                            "required": [
                              "project",
                              "workspaceRoot",
                              "service",
                              "component",
                              "endpoint",
                              "transport"
                            ],
                            "type": "object"
                          },
                          "lastUsedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "mode": {
                            "enum": [
                              "sticky",
                              "ephemeral"
                            ],
                            "type": "string"
                          },
                          "preferredPort": {
                            "anyOf": [
                              {
                                "maximum": 65535,
                                "minimum": 1,
                                "type": "integer"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "updatedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "id",
                          "identity",
                          "mode",
                          "assignedPort",
                          "preferredPort",
                          "exactPort",
                          "assignmentExpiresAt",
                          "createdAt",
                          "updatedAt",
                          "lastUsedAt"
                        ],
                        "type": "object"
                      },
                      "reason": {
                        "const": "workspace-missing",
                        "type": "string"
                      }
                    },
                    "required": [
                      "claim",
                      "reason"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "deletedClaimIds": {
                  "items": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "type": "array"
                },
                "dryRun": {
                  "type": "boolean"
                },
                "skipped": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "reason": {
                        "minLength": 1,
                        "type": "string"
                      }
                    },
                    "required": [
                      "claimId",
                      "reason"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                }
              },
              "required": [
                "dryRun",
                "candidates",
                "deletedClaimIds",
                "skipped"
              ],
              "type": "object"
            }
          },
          "required": [
            "changed",
            "replayed",
            "result"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_lease_acquire`

Acquire one standalone port lease and retain its credential in this bridge behind an opaque handle.

- **Title:** Acquire a port lease
- **Family:** leases
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_lease_acquire`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "allocation": {
      "additionalProperties": false,
      "default": {
        "mode": "sticky",
        "replacementPolicy": "never"
      },
      "properties": {
        "exactPort": {
          "maximum": 65535,
          "minimum": 1,
          "type": "integer"
        },
        "mode": {
          "default": "sticky",
          "enum": [
            "sticky",
            "ephemeral"
          ],
          "type": "string"
        },
        "preferredPort": {
          "maximum": 65535,
          "minimum": 1,
          "type": "integer"
        },
        "replacementPolicy": {
          "default": "never",
          "enum": [
            "never",
            "graceful",
            "force-after-grace"
          ],
          "type": "string"
        }
      },
      "required": [
        "mode",
        "replacementPolicy"
      ],
      "type": "object"
    },
    "claim": {
      "additionalProperties": false,
      "properties": {
        "component": {
          "maxLength": 128,
          "minLength": 1,
          "type": "string"
        },
        "endpoint": {
          "default": "default",
          "maxLength": 128,
          "minLength": 1,
          "type": "string"
        },
        "project": {
          "maxLength": 128,
          "minLength": 1,
          "type": "string"
        },
        "service": {
          "maxLength": 128,
          "minLength": 1,
          "type": "string"
        },
        "transport": {
          "const": "tcp",
          "default": "tcp",
          "type": "string"
        },
        "workspaceRoot": {
          "minLength": 1,
          "type": "string"
        }
      },
      "required": [
        "project",
        "workspaceRoot",
        "endpoint",
        "transport"
      ],
      "type": "object"
    }
  },
  "required": [
    "claim",
    "allocation"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_lease_acquire`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "claimId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "credentialHandle": {
              "pattern": "^[A-Za-z0-9_-]{43}$",
              "type": "string"
            },
            "custodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "leaseExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "leaseId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "maximumCustodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "port": {
              "maximum": 65535,
              "minimum": 1,
              "type": "integer"
            },
            "reusedAssignment": {
              "type": "boolean"
            }
          },
          "required": [
            "custodyExpiresAt",
            "maximumCustodyExpiresAt",
            "credentialHandle",
            "leaseId",
            "leaseExpiresAt",
            "changed",
            "claimId",
            "port",
            "reusedAssignment"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_lease_confirm`

Confirm listener ownership for a standalone lease held by this bridge.

- **Title:** Confirm a port lease
- **Family:** leases
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_lease_confirm`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "credentialHandle": {
      "pattern": "^[A-Za-z0-9_-]{43}$",
      "type": "string"
    },
    "rootPid": {
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991,
      "type": "integer"
    }
  },
  "required": [
    "credentialHandle",
    "rootPid"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_lease_confirm`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "claimId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "confirmedAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "leaseId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "port": {
              "maximum": 65535,
              "minimum": 1,
              "type": "integer"
            },
            "runId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            }
          },
          "required": [
            "claimId",
            "leaseId",
            "runId",
            "port",
            "confirmedAt",
            "changed"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_lease_abandon`

Abandon a standalone lease held by this bridge and immediately erase its credential.

- **Title:** Abandon a port lease
- **Family:** leases
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_lease_abandon`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "credentialHandle": {
      "pattern": "^[A-Za-z0-9_-]{43}$",
      "type": "string"
    },
    "reason": {
      "enum": [
        "address-in-use",
        "startup-error",
        "client-cancelled"
      ],
      "type": "string"
    }
  },
  "required": [
    "credentialHandle",
    "reason"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_lease_abandon`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "at": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "changed": {
              "type": "boolean"
            }
          },
          "required": [
            "changed",
            "at"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_run_release`

Release one confirmed run by explicit durable identifier.

- **Title:** Release a confirmed run
- **Family:** leases
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_run_release`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "runId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "runId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_run_release`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "at": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "changed": {
              "type": "boolean"
            }
          },
          "required": [
            "changed",
            "at"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stacks_list`

List registered stacks globally with explicit filters.

- **Title:** List stacks
- **Family:** stacks
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stacks_list`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "afterCursor": {
      "minLength": 1,
      "type": "string"
    },
    "limit": {
      "default": 50,
      "maximum": 200,
      "minimum": 1,
      "type": "integer"
    },
    "project": {
      "type": "string"
    },
    "stackRoot": {
      "type": "string"
    }
  },
  "required": [
    "limit"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stacks_list`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "items": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "createdAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "currentRevision": {
                    "pattern": "^[a-f0-9]{64}$",
                    "type": "string"
                  },
                  "definition": {
                    "additionalProperties": false,
                    "properties": {
                      "components": {
                        "additionalProperties": {
                          "additionalProperties": false,
                          "properties": {
                            "dependencies": {
                              "additionalProperties": {
                                "additionalProperties": false,
                                "properties": {
                                  "component": {
                                    "maxLength": 128,
                                    "minLength": 1,
                                    "type": "string"
                                  },
                                  "endpoint": {
                                    "default": "default",
                                    "maxLength": 128,
                                    "minLength": 1,
                                    "type": "string"
                                  },
                                  "required": {
                                    "default": true,
                                    "type": "boolean"
                                  }
                                },
                                "required": [
                                  "component",
                                  "endpoint",
                                  "required"
                                ],
                                "type": "object"
                              },
                              "default": {},
                              "propertyNames": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              },
                              "type": "object"
                            },
                            "docker": {
                              "additionalProperties": false,
                              "properties": {
                                "service": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                }
                              },
                              "required": [
                                "service"
                              ],
                              "type": "object"
                            },
                            "endpoints": {
                              "additionalProperties": {
                                "additionalProperties": false,
                                "properties": {
                                  "allocation": {
                                    "additionalProperties": false,
                                    "default": {},
                                    "properties": {
                                      "exactPort": {
                                        "maximum": 65535,
                                        "minimum": 1,
                                        "type": "integer"
                                      },
                                      "preferredPort": {
                                        "maximum": 65535,
                                        "minimum": 1,
                                        "type": "integer"
                                      }
                                    },
                                    "type": "object"
                                  },
                                  "docker": {
                                    "additionalProperties": false,
                                    "properties": {
                                      "containerPort": {
                                        "maximum": 65535,
                                        "minimum": 1,
                                        "type": "integer"
                                      }
                                    },
                                    "required": [
                                      "containerPort"
                                    ],
                                    "type": "object"
                                  },
                                  "publish": {
                                    "default": true,
                                    "type": "boolean"
                                  },
                                  "required": {
                                    "default": true,
                                    "type": "boolean"
                                  },
                                  "transport": {
                                    "const": "tcp",
                                    "default": "tcp",
                                    "type": "string"
                                  }
                                },
                                "required": [
                                  "transport",
                                  "publish",
                                  "required",
                                  "allocation"
                                ],
                                "type": "object"
                              },
                              "default": {},
                              "propertyNames": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              },
                              "type": "object"
                            }
                          },
                          "required": [
                            "endpoints",
                            "dependencies"
                          ],
                          "type": "object"
                        },
                        "propertyNames": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "type": "object"
                      },
                      "project": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "version": {
                        "const": 1,
                        "type": "number"
                      }
                    },
                    "required": [
                      "version",
                      "project",
                      "components"
                    ],
                    "type": "object"
                  },
                  "id": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "lastUsedAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "project": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "stackRoot": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "updatedAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "project",
                  "stackRoot",
                  "currentRevision",
                  "definition",
                  "createdAt",
                  "updatedAt",
                  "lastUsedAt"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "page": {
              "additionalProperties": false,
              "properties": {
                "nextCursor": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "nextCursor"
              ],
              "type": "object"
            }
          },
          "required": [
            "items",
            "page"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stack_get`

Read one registered stack by explicit identifier.

- **Title:** Get a stack
- **Family:** stacks
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stack_get`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "id": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "id"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stack_get`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "createdAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "currentRevision": {
              "pattern": "^[a-f0-9]{64}$",
              "type": "string"
            },
            "definition": {
              "additionalProperties": false,
              "properties": {
                "components": {
                  "additionalProperties": {
                    "additionalProperties": false,
                    "properties": {
                      "dependencies": {
                        "additionalProperties": {
                          "additionalProperties": false,
                          "properties": {
                            "component": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "endpoint": {
                              "default": "default",
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "required": {
                              "default": true,
                              "type": "boolean"
                            }
                          },
                          "required": [
                            "component",
                            "endpoint",
                            "required"
                          ],
                          "type": "object"
                        },
                        "default": {},
                        "propertyNames": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "type": "object"
                      },
                      "docker": {
                        "additionalProperties": false,
                        "properties": {
                          "service": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          }
                        },
                        "required": [
                          "service"
                        ],
                        "type": "object"
                      },
                      "endpoints": {
                        "additionalProperties": {
                          "additionalProperties": false,
                          "properties": {
                            "allocation": {
                              "additionalProperties": false,
                              "default": {},
                              "properties": {
                                "exactPort": {
                                  "maximum": 65535,
                                  "minimum": 1,
                                  "type": "integer"
                                },
                                "preferredPort": {
                                  "maximum": 65535,
                                  "minimum": 1,
                                  "type": "integer"
                                }
                              },
                              "type": "object"
                            },
                            "docker": {
                              "additionalProperties": false,
                              "properties": {
                                "containerPort": {
                                  "maximum": 65535,
                                  "minimum": 1,
                                  "type": "integer"
                                }
                              },
                              "required": [
                                "containerPort"
                              ],
                              "type": "object"
                            },
                            "publish": {
                              "default": true,
                              "type": "boolean"
                            },
                            "required": {
                              "default": true,
                              "type": "boolean"
                            },
                            "transport": {
                              "const": "tcp",
                              "default": "tcp",
                              "type": "string"
                            }
                          },
                          "required": [
                            "transport",
                            "publish",
                            "required",
                            "allocation"
                          ],
                          "type": "object"
                        },
                        "default": {},
                        "propertyNames": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "type": "object"
                      }
                    },
                    "required": [
                      "endpoints",
                      "dependencies"
                    ],
                    "type": "object"
                  },
                  "propertyNames": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "type": "object"
                },
                "project": {
                  "maxLength": 128,
                  "minLength": 1,
                  "type": "string"
                },
                "version": {
                  "const": 1,
                  "type": "number"
                }
              },
              "required": [
                "version",
                "project",
                "components"
              ],
              "type": "object"
            },
            "id": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "lastUsedAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "project": {
              "maxLength": 128,
              "minLength": 1,
              "type": "string"
            },
            "stackRoot": {
              "minLength": 1,
              "type": "string"
            },
            "updatedAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            }
          },
          "required": [
            "id",
            "project",
            "stackRoot",
            "currentRevision",
            "definition",
            "createdAt",
            "updatedAt",
            "lastUsedAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stack_document_get`

Read the structured fixed portreeve.stack.json document for one explicit existing stack root. This is not arbitrary filesystem access.

- **Title:** Get canonical stack document
- **Family:** stacks
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stack_document_get`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "stackRoot": {
      "minLength": 1,
      "type": "string"
    }
  },
  "required": [
    "stackRoot"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stack_document_get`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "definition": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "components": {
                      "additionalProperties": {
                        "additionalProperties": false,
                        "properties": {
                          "dependencies": {
                            "additionalProperties": {
                              "additionalProperties": false,
                              "properties": {
                                "component": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "endpoint": {
                                  "default": "default",
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "required": {
                                  "default": true,
                                  "type": "boolean"
                                }
                              },
                              "required": [
                                "component",
                                "endpoint",
                                "required"
                              ],
                              "type": "object"
                            },
                            "default": {},
                            "propertyNames": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "type": "object"
                          },
                          "docker": {
                            "additionalProperties": false,
                            "properties": {
                              "service": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              }
                            },
                            "required": [
                              "service"
                            ],
                            "type": "object"
                          },
                          "endpoints": {
                            "additionalProperties": {
                              "additionalProperties": false,
                              "properties": {
                                "allocation": {
                                  "additionalProperties": false,
                                  "default": {},
                                  "properties": {
                                    "exactPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    },
                                    "preferredPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    }
                                  },
                                  "type": "object"
                                },
                                "docker": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "containerPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    }
                                  },
                                  "required": [
                                    "containerPort"
                                  ],
                                  "type": "object"
                                },
                                "publish": {
                                  "default": true,
                                  "type": "boolean"
                                },
                                "required": {
                                  "default": true,
                                  "type": "boolean"
                                },
                                "transport": {
                                  "const": "tcp",
                                  "default": "tcp",
                                  "type": "string"
                                }
                              },
                              "required": [
                                "transport",
                                "publish",
                                "required",
                                "allocation"
                              ],
                              "type": "object"
                            },
                            "default": {},
                            "propertyNames": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "type": "object"
                          }
                        },
                        "required": [
                          "endpoints",
                          "dependencies"
                        ],
                        "type": "object"
                      },
                      "propertyNames": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "type": "object"
                    },
                    "project": {
                      "maxLength": 128,
                      "minLength": 1,
                      "type": "string"
                    },
                    "version": {
                      "const": 1,
                      "type": "number"
                    }
                  },
                  "required": [
                    "version",
                    "project",
                    "components"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "fingerprint": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "issues": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "code": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "message": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "path": {
                    "items": {
                      "type": "string"
                    },
                    "type": "array"
                  }
                },
                "required": [
                  "code",
                  "message",
                  "path"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "kind": {
              "enum": [
                "missing",
                "regular",
                "non-regular",
                "oversized"
              ],
              "type": "string"
            },
            "path": {
              "minLength": 1,
              "type": "string"
            },
            "revision": {
              "anyOf": [
                {
                  "pattern": "^[a-f0-9]{64}$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "stackRoot": {
              "minLength": 1,
              "type": "string"
            },
            "stackRootName": {
              "minLength": 1,
              "type": "string"
            }
          },
          "required": [
            "stackRoot",
            "stackRootName",
            "path",
            "kind",
            "fingerprint",
            "definition",
            "revision",
            "issues"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stack_definition_validate`

Validate and normalize a typed PortReeve stack definition without reading or writing a file.

- **Title:** Validate stack definition
- **Family:** stacks
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stack_definition_validate`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "definition": {}
  },
  "required": [
    "definition"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stack_definition_validate`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "definition": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "components": {
                      "additionalProperties": {
                        "additionalProperties": false,
                        "properties": {
                          "dependencies": {
                            "additionalProperties": {
                              "additionalProperties": false,
                              "properties": {
                                "component": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "endpoint": {
                                  "default": "default",
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "required": {
                                  "default": true,
                                  "type": "boolean"
                                }
                              },
                              "required": [
                                "component",
                                "endpoint",
                                "required"
                              ],
                              "type": "object"
                            },
                            "default": {},
                            "propertyNames": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "type": "object"
                          },
                          "docker": {
                            "additionalProperties": false,
                            "properties": {
                              "service": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              }
                            },
                            "required": [
                              "service"
                            ],
                            "type": "object"
                          },
                          "endpoints": {
                            "additionalProperties": {
                              "additionalProperties": false,
                              "properties": {
                                "allocation": {
                                  "additionalProperties": false,
                                  "default": {},
                                  "properties": {
                                    "exactPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    },
                                    "preferredPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    }
                                  },
                                  "type": "object"
                                },
                                "docker": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "containerPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    }
                                  },
                                  "required": [
                                    "containerPort"
                                  ],
                                  "type": "object"
                                },
                                "publish": {
                                  "default": true,
                                  "type": "boolean"
                                },
                                "required": {
                                  "default": true,
                                  "type": "boolean"
                                },
                                "transport": {
                                  "const": "tcp",
                                  "default": "tcp",
                                  "type": "string"
                                }
                              },
                              "required": [
                                "transport",
                                "publish",
                                "required",
                                "allocation"
                              ],
                              "type": "object"
                            },
                            "default": {},
                            "propertyNames": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "type": "object"
                          }
                        },
                        "required": [
                          "endpoints",
                          "dependencies"
                        ],
                        "type": "object"
                      },
                      "propertyNames": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "type": "object"
                    },
                    "project": {
                      "maxLength": 128,
                      "minLength": 1,
                      "type": "string"
                    },
                    "version": {
                      "const": 1,
                      "type": "number"
                    }
                  },
                  "required": [
                    "version",
                    "project",
                    "components"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "issues": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "code": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "message": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "path": {
                    "items": {
                      "type": "string"
                    },
                    "type": "array"
                  }
                },
                "required": [
                  "code",
                  "message",
                  "path"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "revision": {
              "anyOf": [
                {
                  "pattern": "^[a-f0-9]{64}$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "valid": {
              "type": "boolean"
            }
          },
          "required": [
            "valid",
            "definition",
            "revision",
            "issues"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stack_status`

Inspect current generation, activation, and provider evidence.

- **Title:** Get stack status
- **Family:** stacks
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stack_status`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "stackId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "stackId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stack_status`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activation": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "confirmedAt": {
                      "anyOf": [
                        {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "createdAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    "endedAt": {
                      "anyOf": [
                        {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "endpoints": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "bindingKind": {
                            "enum": [
                              "process",
                              "docker"
                            ],
                            "type": "string"
                          },
                          "claimId": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          "component": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "endpoint": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "expiresAt": {
                            "anyOf": [
                              {
                                "format": "date-time",
                                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "failureReason": {
                            "anyOf": [
                              {
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "leaseId": {
                            "anyOf": [
                              {
                                "format": "uuid",
                                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "port": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "required": {
                            "type": "boolean"
                          },
                          "runId": {
                            "anyOf": [
                              {
                                "format": "uuid",
                                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "state": {
                            "enum": [
                              "leased",
                              "confirmed",
                              "skipped",
                              "failed",
                              "released"
                            ],
                            "type": "string"
                          },
                          "updatedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "component",
                          "endpoint",
                          "claimId",
                          "port",
                          "required",
                          "bindingKind",
                          "state",
                          "leaseId",
                          "runId",
                          "expiresAt",
                          "failureReason",
                          "updatedAt"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "generationId": {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    "id": {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    "stackId": {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    "state": {
                      "enum": [
                        "starting",
                        "confirmed",
                        "degraded",
                        "failed",
                        "lost",
                        "ended"
                      ],
                      "type": "string"
                    },
                    "updatedAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    }
                  },
                  "required": [
                    "id",
                    "stackId",
                    "generationId",
                    "state",
                    "endpoints",
                    "createdAt",
                    "updatedAt",
                    "confirmedAt",
                    "endedAt"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "generation": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "createdAt": {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    "endpoints": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "claimId": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          "component": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "endpoint": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "host": {
                            "const": "127.0.0.1",
                            "type": "string"
                          },
                          "port": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "required": {
                            "type": "boolean"
                          },
                          "transport": {
                            "const": "tcp",
                            "type": "string"
                          }
                        },
                        "required": [
                          "claimId",
                          "component",
                          "endpoint",
                          "transport",
                          "host",
                          "port",
                          "required"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "id": {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    "invalidatedAt": {
                      "anyOf": [
                        {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "revision": {
                      "pattern": "^[a-f0-9]{64}$",
                      "type": "string"
                    },
                    "stackId": {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    "state": {
                      "enum": [
                        "valid",
                        "stale"
                      ],
                      "type": "string"
                    }
                  },
                  "required": [
                    "id",
                    "stackId",
                    "revision",
                    "state",
                    "endpoints",
                    "createdAt",
                    "invalidatedAt"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "providers": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "bindingKind": {
                    "enum": [
                      "process",
                      "docker"
                    ],
                    "type": "string"
                  },
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "containerId": {
                    "anyOf": [
                      {
                        "maxLength": 64,
                        "minLength": 12,
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "listeners": {
                    "maximum": 9007199254740991,
                    "minimum": 0,
                    "type": "integer"
                  },
                  "port": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  },
                  "reason": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "runId": {
                    "anyOf": [
                      {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "status": {
                    "enum": [
                      "active",
                      "gone",
                      "unknown"
                    ],
                    "type": "string"
                  }
                },
                "required": [
                  "component",
                  "endpoint",
                  "port",
                  "bindingKind",
                  "status",
                  "reason",
                  "listeners",
                  "runId",
                  "containerId"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "stack": {
              "additionalProperties": false,
              "properties": {
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "currentRevision": {
                  "pattern": "^[a-f0-9]{64}$",
                  "type": "string"
                },
                "definition": {
                  "additionalProperties": false,
                  "properties": {
                    "components": {
                      "additionalProperties": {
                        "additionalProperties": false,
                        "properties": {
                          "dependencies": {
                            "additionalProperties": {
                              "additionalProperties": false,
                              "properties": {
                                "component": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "endpoint": {
                                  "default": "default",
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "required": {
                                  "default": true,
                                  "type": "boolean"
                                }
                              },
                              "required": [
                                "component",
                                "endpoint",
                                "required"
                              ],
                              "type": "object"
                            },
                            "default": {},
                            "propertyNames": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "type": "object"
                          },
                          "docker": {
                            "additionalProperties": false,
                            "properties": {
                              "service": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              }
                            },
                            "required": [
                              "service"
                            ],
                            "type": "object"
                          },
                          "endpoints": {
                            "additionalProperties": {
                              "additionalProperties": false,
                              "properties": {
                                "allocation": {
                                  "additionalProperties": false,
                                  "default": {},
                                  "properties": {
                                    "exactPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    },
                                    "preferredPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    }
                                  },
                                  "type": "object"
                                },
                                "docker": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "containerPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    }
                                  },
                                  "required": [
                                    "containerPort"
                                  ],
                                  "type": "object"
                                },
                                "publish": {
                                  "default": true,
                                  "type": "boolean"
                                },
                                "required": {
                                  "default": true,
                                  "type": "boolean"
                                },
                                "transport": {
                                  "const": "tcp",
                                  "default": "tcp",
                                  "type": "string"
                                }
                              },
                              "required": [
                                "transport",
                                "publish",
                                "required",
                                "allocation"
                              ],
                              "type": "object"
                            },
                            "default": {},
                            "propertyNames": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "type": "object"
                          }
                        },
                        "required": [
                          "endpoints",
                          "dependencies"
                        ],
                        "type": "object"
                      },
                      "propertyNames": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "type": "object"
                    },
                    "project": {
                      "maxLength": 128,
                      "minLength": 1,
                      "type": "string"
                    },
                    "version": {
                      "const": 1,
                      "type": "number"
                    }
                  },
                  "required": [
                    "version",
                    "project",
                    "components"
                  ],
                  "type": "object"
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "lastUsedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "project": {
                  "maxLength": 128,
                  "minLength": 1,
                  "type": "string"
                },
                "stackRoot": {
                  "minLength": 1,
                  "type": "string"
                },
                "updatedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "project",
                "stackRoot",
                "currentRevision",
                "definition",
                "createdAt",
                "updatedAt",
                "lastUsedAt"
              ],
              "type": "object"
            }
          },
          "required": [
            "stack",
            "generation",
            "activation",
            "providers"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stack_prepare`

Prepare or reuse one valid allocation generation for an explicit stack.

- **Title:** Prepare a stack generation
- **Family:** stacks
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stack_prepare`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "stackId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "stackId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stack_prepare`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "generation": {
              "additionalProperties": false,
              "properties": {
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "endpoints": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "component": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "endpoint": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "host": {
                        "const": "127.0.0.1",
                        "type": "string"
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "required": {
                        "type": "boolean"
                      },
                      "transport": {
                        "const": "tcp",
                        "type": "string"
                      }
                    },
                    "required": [
                      "claimId",
                      "component",
                      "endpoint",
                      "transport",
                      "host",
                      "port",
                      "required"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "invalidatedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "revision": {
                  "pattern": "^[a-f0-9]{64}$",
                  "type": "string"
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "valid",
                    "stale"
                  ],
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "revision",
                "state",
                "endpoints",
                "createdAt",
                "invalidatedAt"
              ],
              "type": "object"
            },
            "reused": {
              "type": "boolean"
            }
          },
          "required": [
            "reused",
            "generation",
            "changed"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stack_apply_preview`

Validate a typed stack definition, inspect only its fixed canonical document, and issue a fingerprint-bound five-minute receipt.

- **Title:** Preview stack apply
- **Family:** stacks
- **Safety:** mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stack_apply_preview`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "definition": {
      "additionalProperties": false,
      "properties": {
        "components": {
          "additionalProperties": {
            "additionalProperties": false,
            "properties": {
              "dependencies": {
                "additionalProperties": {
                  "additionalProperties": false,
                  "properties": {
                    "component": {
                      "maxLength": 128,
                      "minLength": 1,
                      "type": "string"
                    },
                    "endpoint": {
                      "default": "default",
                      "maxLength": 128,
                      "minLength": 1,
                      "type": "string"
                    },
                    "required": {
                      "default": true,
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "component",
                    "endpoint",
                    "required"
                  ],
                  "type": "object"
                },
                "default": {},
                "propertyNames": {
                  "maxLength": 128,
                  "minLength": 1,
                  "type": "string"
                },
                "type": "object"
              },
              "docker": {
                "additionalProperties": false,
                "properties": {
                  "service": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  }
                },
                "required": [
                  "service"
                ],
                "type": "object"
              },
              "endpoints": {
                "additionalProperties": {
                  "additionalProperties": false,
                  "properties": {
                    "allocation": {
                      "additionalProperties": false,
                      "default": {},
                      "properties": {
                        "exactPort": {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        "preferredPort": {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        }
                      },
                      "type": "object"
                    },
                    "docker": {
                      "additionalProperties": false,
                      "properties": {
                        "containerPort": {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        }
                      },
                      "required": [
                        "containerPort"
                      ],
                      "type": "object"
                    },
                    "publish": {
                      "default": true,
                      "type": "boolean"
                    },
                    "required": {
                      "default": true,
                      "type": "boolean"
                    },
                    "transport": {
                      "const": "tcp",
                      "default": "tcp",
                      "type": "string"
                    }
                  },
                  "required": [
                    "transport",
                    "publish",
                    "required",
                    "allocation"
                  ],
                  "type": "object"
                },
                "default": {},
                "propertyNames": {
                  "maxLength": 128,
                  "minLength": 1,
                  "type": "string"
                },
                "type": "object"
              }
            },
            "required": [
              "endpoints",
              "dependencies"
            ],
            "type": "object"
          },
          "propertyNames": {
            "maxLength": 128,
            "minLength": 1,
            "type": "string"
          },
          "type": "object"
        },
        "project": {
          "maxLength": 128,
          "minLength": 1,
          "type": "string"
        },
        "version": {
          "const": 1,
          "type": "number"
        }
      },
      "required": [
        "version",
        "project",
        "components"
      ],
      "type": "object"
    },
    "stackRoot": {
      "minLength": 1,
      "type": "string"
    }
  },
  "required": [
    "stackRoot",
    "definition"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stack_apply_preview`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "action": {
              "const": "stack.apply",
              "type": "string"
            },
            "expiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "observed": {
              "additionalProperties": false,
              "properties": {
                "document": {
                  "additionalProperties": false,
                  "properties": {
                    "fingerprint": {
                      "anyOf": [
                        {
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "issues": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "code": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "message": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "path": {
                            "items": {
                              "type": "string"
                            },
                            "type": "array"
                          }
                        },
                        "required": [
                          "code",
                          "message",
                          "path"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "kind": {
                      "enum": [
                        "missing",
                        "regular",
                        "non-regular",
                        "oversized"
                      ],
                      "type": "string"
                    },
                    "path": {
                      "minLength": 1,
                      "type": "string"
                    },
                    "revision": {
                      "anyOf": [
                        {
                          "pattern": "^[a-f0-9]{64}$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    }
                  },
                  "required": [
                    "path",
                    "kind",
                    "fingerprint",
                    "revision",
                    "issues"
                  ],
                  "type": "object"
                },
                "stack": {
                  "additionalProperties": false,
                  "properties": {
                    "changed": {
                      "type": "boolean"
                    },
                    "definition": {
                      "additionalProperties": false,
                      "properties": {
                        "components": {
                          "additionalProperties": {
                            "additionalProperties": false,
                            "properties": {
                              "dependencies": {
                                "additionalProperties": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "component": {
                                      "maxLength": 128,
                                      "minLength": 1,
                                      "type": "string"
                                    },
                                    "endpoint": {
                                      "default": "default",
                                      "maxLength": 128,
                                      "minLength": 1,
                                      "type": "string"
                                    },
                                    "required": {
                                      "default": true,
                                      "type": "boolean"
                                    }
                                  },
                                  "required": [
                                    "component",
                                    "endpoint",
                                    "required"
                                  ],
                                  "type": "object"
                                },
                                "default": {},
                                "propertyNames": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "type": "object"
                              },
                              "docker": {
                                "additionalProperties": false,
                                "properties": {
                                  "service": {
                                    "maxLength": 128,
                                    "minLength": 1,
                                    "type": "string"
                                  }
                                },
                                "required": [
                                  "service"
                                ],
                                "type": "object"
                              },
                              "endpoints": {
                                "additionalProperties": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "allocation": {
                                      "additionalProperties": false,
                                      "default": {},
                                      "properties": {
                                        "exactPort": {
                                          "maximum": 65535,
                                          "minimum": 1,
                                          "type": "integer"
                                        },
                                        "preferredPort": {
                                          "maximum": 65535,
                                          "minimum": 1,
                                          "type": "integer"
                                        }
                                      },
                                      "type": "object"
                                    },
                                    "docker": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "containerPort": {
                                          "maximum": 65535,
                                          "minimum": 1,
                                          "type": "integer"
                                        }
                                      },
                                      "required": [
                                        "containerPort"
                                      ],
                                      "type": "object"
                                    },
                                    "publish": {
                                      "default": true,
                                      "type": "boolean"
                                    },
                                    "required": {
                                      "default": true,
                                      "type": "boolean"
                                    },
                                    "transport": {
                                      "const": "tcp",
                                      "default": "tcp",
                                      "type": "string"
                                    }
                                  },
                                  "required": [
                                    "transport",
                                    "publish",
                                    "required",
                                    "allocation"
                                  ],
                                  "type": "object"
                                },
                                "default": {},
                                "propertyNames": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "type": "object"
                              }
                            },
                            "required": [
                              "endpoints",
                              "dependencies"
                            ],
                            "type": "object"
                          },
                          "propertyNames": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "type": "object"
                        },
                        "project": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "version": {
                          "const": 1,
                          "type": "number"
                        }
                      },
                      "required": [
                        "version",
                        "project",
                        "components"
                      ],
                      "type": "object"
                    },
                    "existing": {
                      "anyOf": [
                        {
                          "additionalProperties": false,
                          "properties": {
                            "createdAt": {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            "currentRevision": {
                              "pattern": "^[a-f0-9]{64}$",
                              "type": "string"
                            },
                            "definition": {
                              "additionalProperties": false,
                              "properties": {
                                "components": {
                                  "additionalProperties": {
                                    "additionalProperties": false,
                                    "properties": {
                                      "dependencies": {
                                        "additionalProperties": {
                                          "additionalProperties": false,
                                          "properties": {
                                            "component": {
                                              "maxLength": 128,
                                              "minLength": 1,
                                              "type": "string"
                                            },
                                            "endpoint": {
                                              "default": "default",
                                              "maxLength": 128,
                                              "minLength": 1,
                                              "type": "string"
                                            },
                                            "required": {
                                              "default": true,
                                              "type": "boolean"
                                            }
                                          },
                                          "required": [
                                            "component",
                                            "endpoint",
                                            "required"
                                          ],
                                          "type": "object"
                                        },
                                        "default": {},
                                        "propertyNames": {
                                          "maxLength": 128,
                                          "minLength": 1,
                                          "type": "string"
                                        },
                                        "type": "object"
                                      },
                                      "docker": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "service": {
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          }
                                        },
                                        "required": [
                                          "service"
                                        ],
                                        "type": "object"
                                      },
                                      "endpoints": {
                                        "additionalProperties": {
                                          "additionalProperties": false,
                                          "properties": {
                                            "allocation": {
                                              "additionalProperties": false,
                                              "default": {},
                                              "properties": {
                                                "exactPort": {
                                                  "maximum": 65535,
                                                  "minimum": 1,
                                                  "type": "integer"
                                                },
                                                "preferredPort": {
                                                  "maximum": 65535,
                                                  "minimum": 1,
                                                  "type": "integer"
                                                }
                                              },
                                              "type": "object"
                                            },
                                            "docker": {
                                              "additionalProperties": false,
                                              "properties": {
                                                "containerPort": {
                                                  "maximum": 65535,
                                                  "minimum": 1,
                                                  "type": "integer"
                                                }
                                              },
                                              "required": [
                                                "containerPort"
                                              ],
                                              "type": "object"
                                            },
                                            "publish": {
                                              "default": true,
                                              "type": "boolean"
                                            },
                                            "required": {
                                              "default": true,
                                              "type": "boolean"
                                            },
                                            "transport": {
                                              "const": "tcp",
                                              "default": "tcp",
                                              "type": "string"
                                            }
                                          },
                                          "required": [
                                            "transport",
                                            "publish",
                                            "required",
                                            "allocation"
                                          ],
                                          "type": "object"
                                        },
                                        "default": {},
                                        "propertyNames": {
                                          "maxLength": 128,
                                          "minLength": 1,
                                          "type": "string"
                                        },
                                        "type": "object"
                                      }
                                    },
                                    "required": [
                                      "endpoints",
                                      "dependencies"
                                    ],
                                    "type": "object"
                                  },
                                  "propertyNames": {
                                    "maxLength": 128,
                                    "minLength": 1,
                                    "type": "string"
                                  },
                                  "type": "object"
                                },
                                "project": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "version": {
                                  "const": 1,
                                  "type": "number"
                                }
                              },
                              "required": [
                                "version",
                                "project",
                                "components"
                              ],
                              "type": "object"
                            },
                            "id": {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            "lastUsedAt": {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            "project": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "stackRoot": {
                              "minLength": 1,
                              "type": "string"
                            },
                            "updatedAt": {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            }
                          },
                          "required": [
                            "id",
                            "project",
                            "stackRoot",
                            "currentRevision",
                            "definition",
                            "createdAt",
                            "updatedAt",
                            "lastUsedAt"
                          ],
                          "type": "object"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "revision": {
                      "pattern": "^[a-f0-9]{64}$",
                      "type": "string"
                    }
                  },
                  "required": [
                    "changed",
                    "existing",
                    "revision",
                    "definition"
                  ],
                  "type": "object"
                }
              },
              "required": [
                "document",
                "stack"
              ],
              "type": "object"
            },
            "proposal": {
              "additionalProperties": false,
              "properties": {
                "definition": {
                  "additionalProperties": false,
                  "properties": {
                    "components": {
                      "additionalProperties": {
                        "additionalProperties": false,
                        "properties": {
                          "dependencies": {
                            "additionalProperties": {
                              "additionalProperties": false,
                              "properties": {
                                "component": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "endpoint": {
                                  "default": "default",
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "required": {
                                  "default": true,
                                  "type": "boolean"
                                }
                              },
                              "required": [
                                "component",
                                "endpoint",
                                "required"
                              ],
                              "type": "object"
                            },
                            "default": {},
                            "propertyNames": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "type": "object"
                          },
                          "docker": {
                            "additionalProperties": false,
                            "properties": {
                              "service": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              }
                            },
                            "required": [
                              "service"
                            ],
                            "type": "object"
                          },
                          "endpoints": {
                            "additionalProperties": {
                              "additionalProperties": false,
                              "properties": {
                                "allocation": {
                                  "additionalProperties": false,
                                  "default": {},
                                  "properties": {
                                    "exactPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    },
                                    "preferredPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    }
                                  },
                                  "type": "object"
                                },
                                "docker": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "containerPort": {
                                      "maximum": 65535,
                                      "minimum": 1,
                                      "type": "integer"
                                    }
                                  },
                                  "required": [
                                    "containerPort"
                                  ],
                                  "type": "object"
                                },
                                "publish": {
                                  "default": true,
                                  "type": "boolean"
                                },
                                "required": {
                                  "default": true,
                                  "type": "boolean"
                                },
                                "transport": {
                                  "const": "tcp",
                                  "default": "tcp",
                                  "type": "string"
                                }
                              },
                              "required": [
                                "transport",
                                "publish",
                                "required",
                                "allocation"
                              ],
                              "type": "object"
                            },
                            "default": {},
                            "propertyNames": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "type": "object"
                          }
                        },
                        "required": [
                          "endpoints",
                          "dependencies"
                        ],
                        "type": "object"
                      },
                      "propertyNames": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "type": "object"
                    },
                    "project": {
                      "maxLength": 128,
                      "minLength": 1,
                      "type": "string"
                    },
                    "version": {
                      "const": 1,
                      "type": "number"
                    }
                  },
                  "required": [
                    "version",
                    "project",
                    "components"
                  ],
                  "type": "object"
                },
                "revision": {
                  "pattern": "^[a-f0-9]{64}$",
                  "type": "string"
                }
              },
              "required": [
                "definition",
                "revision"
              ],
              "type": "object"
            },
            "receiptId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "target": {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "minLength": 1,
                  "type": "string"
                },
                "type": {
                  "const": "stack-root",
                  "type": "string"
                }
              },
              "required": [
                "type",
                "id"
              ],
              "type": "object"
            }
          },
          "required": [
            "receiptId",
            "action",
            "target",
            "proposal",
            "observed",
            "expiresAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stack_apply_execute`

Write the fixed canonical stack document and apply it only when document and registry evidence still match the receipt.

- **Title:** Execute stack apply
- **Family:** stacks
- **Safety:** consequential-mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive yes; idempotent yes; open-world no

#### Input schema for `portreeve_stack_apply_execute`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "receiptId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "stackRoot": {
      "minLength": 1,
      "type": "string"
    }
  },
  "required": [
    "receiptId",
    "stackRoot"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stack_apply_execute`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "replayed": {
              "type": "boolean"
            },
            "result": {
              "oneOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "applied": {
                      "const": true,
                      "type": "boolean"
                    },
                    "changed": {
                      "type": "boolean"
                    },
                    "fingerprint": {
                      "pattern": "^[a-f0-9]{64}$",
                      "type": "string"
                    },
                    "path": {
                      "minLength": 1,
                      "type": "string"
                    },
                    "revision": {
                      "pattern": "^[a-f0-9]{64}$",
                      "type": "string"
                    },
                    "saved": {
                      "const": true,
                      "type": "boolean"
                    },
                    "stack": {
                      "additionalProperties": false,
                      "properties": {
                        "createdAt": {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        "currentRevision": {
                          "pattern": "^[a-f0-9]{64}$",
                          "type": "string"
                        },
                        "definition": {
                          "additionalProperties": false,
                          "properties": {
                            "components": {
                              "additionalProperties": {
                                "additionalProperties": false,
                                "properties": {
                                  "dependencies": {
                                    "additionalProperties": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "component": {
                                          "maxLength": 128,
                                          "minLength": 1,
                                          "type": "string"
                                        },
                                        "endpoint": {
                                          "default": "default",
                                          "maxLength": 128,
                                          "minLength": 1,
                                          "type": "string"
                                        },
                                        "required": {
                                          "default": true,
                                          "type": "boolean"
                                        }
                                      },
                                      "required": [
                                        "component",
                                        "endpoint",
                                        "required"
                                      ],
                                      "type": "object"
                                    },
                                    "default": {},
                                    "propertyNames": {
                                      "maxLength": 128,
                                      "minLength": 1,
                                      "type": "string"
                                    },
                                    "type": "object"
                                  },
                                  "docker": {
                                    "additionalProperties": false,
                                    "properties": {
                                      "service": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      }
                                    },
                                    "required": [
                                      "service"
                                    ],
                                    "type": "object"
                                  },
                                  "endpoints": {
                                    "additionalProperties": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "allocation": {
                                          "additionalProperties": false,
                                          "default": {},
                                          "properties": {
                                            "exactPort": {
                                              "maximum": 65535,
                                              "minimum": 1,
                                              "type": "integer"
                                            },
                                            "preferredPort": {
                                              "maximum": 65535,
                                              "minimum": 1,
                                              "type": "integer"
                                            }
                                          },
                                          "type": "object"
                                        },
                                        "docker": {
                                          "additionalProperties": false,
                                          "properties": {
                                            "containerPort": {
                                              "maximum": 65535,
                                              "minimum": 1,
                                              "type": "integer"
                                            }
                                          },
                                          "required": [
                                            "containerPort"
                                          ],
                                          "type": "object"
                                        },
                                        "publish": {
                                          "default": true,
                                          "type": "boolean"
                                        },
                                        "required": {
                                          "default": true,
                                          "type": "boolean"
                                        },
                                        "transport": {
                                          "const": "tcp",
                                          "default": "tcp",
                                          "type": "string"
                                        }
                                      },
                                      "required": [
                                        "transport",
                                        "publish",
                                        "required",
                                        "allocation"
                                      ],
                                      "type": "object"
                                    },
                                    "default": {},
                                    "propertyNames": {
                                      "maxLength": 128,
                                      "minLength": 1,
                                      "type": "string"
                                    },
                                    "type": "object"
                                  }
                                },
                                "required": [
                                  "endpoints",
                                  "dependencies"
                                ],
                                "type": "object"
                              },
                              "propertyNames": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              },
                              "type": "object"
                            },
                            "project": {
                              "maxLength": 128,
                              "minLength": 1,
                              "type": "string"
                            },
                            "version": {
                              "const": 1,
                              "type": "number"
                            }
                          },
                          "required": [
                            "version",
                            "project",
                            "components"
                          ],
                          "type": "object"
                        },
                        "id": {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        "lastUsedAt": {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        "project": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "stackRoot": {
                          "minLength": 1,
                          "type": "string"
                        },
                        "updatedAt": {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        }
                      },
                      "required": [
                        "id",
                        "project",
                        "stackRoot",
                        "currentRevision",
                        "definition",
                        "createdAt",
                        "updatedAt",
                        "lastUsedAt"
                      ],
                      "type": "object"
                    }
                  },
                  "required": [
                    "saved",
                    "applied",
                    "path",
                    "fingerprint",
                    "revision",
                    "changed",
                    "stack"
                  ],
                  "type": "object"
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "applied": {
                      "const": false,
                      "type": "boolean"
                    },
                    "error": {
                      "additionalProperties": false,
                      "properties": {
                        "code": {
                          "minLength": 1,
                          "type": "string"
                        },
                        "message": {
                          "minLength": 1,
                          "type": "string"
                        }
                      },
                      "required": [
                        "code",
                        "message"
                      ],
                      "type": "object"
                    },
                    "fingerprint": {
                      "pattern": "^[a-f0-9]{64}$",
                      "type": "string"
                    },
                    "path": {
                      "minLength": 1,
                      "type": "string"
                    },
                    "revision": {
                      "pattern": "^[a-f0-9]{64}$",
                      "type": "string"
                    },
                    "saved": {
                      "const": true,
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "saved",
                    "applied",
                    "path",
                    "fingerprint",
                    "revision",
                    "error"
                  ],
                  "type": "object"
                }
              ]
            }
          },
          "required": [
            "changed",
            "replayed",
            "result"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stacks_prune_preview`

List stale stack candidates and live blockers, then issue a five-minute global prune receipt.

- **Title:** Preview stale-stack pruning
- **Family:** stacks
- **Safety:** mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stacks_prune_preview`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "olderThanMilliseconds": {
      "maximum": 315576000000,
      "minimum": 0,
      "type": "integer"
    }
  },
  "required": [
    "olderThanMilliseconds"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stacks_prune_preview`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "action": {
              "const": "stacks.prune",
              "type": "string"
            },
            "expiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "observed": {
              "additionalProperties": false,
              "properties": {
                "blocked": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "reasons": {
                        "items": {
                          "minLength": 1,
                          "type": "string"
                        },
                        "minItems": 1,
                        "type": "array"
                      },
                      "stack": {
                        "additionalProperties": false,
                        "properties": {
                          "createdAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "currentRevision": {
                            "pattern": "^[a-f0-9]{64}$",
                            "type": "string"
                          },
                          "definition": {
                            "additionalProperties": false,
                            "properties": {
                              "components": {
                                "additionalProperties": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "dependencies": {
                                      "additionalProperties": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "component": {
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          },
                                          "endpoint": {
                                            "default": "default",
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          },
                                          "required": {
                                            "default": true,
                                            "type": "boolean"
                                          }
                                        },
                                        "required": [
                                          "component",
                                          "endpoint",
                                          "required"
                                        ],
                                        "type": "object"
                                      },
                                      "default": {},
                                      "propertyNames": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      },
                                      "type": "object"
                                    },
                                    "docker": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "service": {
                                          "maxLength": 128,
                                          "minLength": 1,
                                          "type": "string"
                                        }
                                      },
                                      "required": [
                                        "service"
                                      ],
                                      "type": "object"
                                    },
                                    "endpoints": {
                                      "additionalProperties": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "allocation": {
                                            "additionalProperties": false,
                                            "default": {},
                                            "properties": {
                                              "exactPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              },
                                              "preferredPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              }
                                            },
                                            "type": "object"
                                          },
                                          "docker": {
                                            "additionalProperties": false,
                                            "properties": {
                                              "containerPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              }
                                            },
                                            "required": [
                                              "containerPort"
                                            ],
                                            "type": "object"
                                          },
                                          "publish": {
                                            "default": true,
                                            "type": "boolean"
                                          },
                                          "required": {
                                            "default": true,
                                            "type": "boolean"
                                          },
                                          "transport": {
                                            "const": "tcp",
                                            "default": "tcp",
                                            "type": "string"
                                          }
                                        },
                                        "required": [
                                          "transport",
                                          "publish",
                                          "required",
                                          "allocation"
                                        ],
                                        "type": "object"
                                      },
                                      "default": {},
                                      "propertyNames": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      },
                                      "type": "object"
                                    }
                                  },
                                  "required": [
                                    "endpoints",
                                    "dependencies"
                                  ],
                                  "type": "object"
                                },
                                "propertyNames": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "type": "object"
                              },
                              "project": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              },
                              "version": {
                                "const": 1,
                                "type": "number"
                              }
                            },
                            "required": [
                              "version",
                              "project",
                              "components"
                            ],
                            "type": "object"
                          },
                          "id": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          "lastUsedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "project": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "stackRoot": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "updatedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "id",
                          "project",
                          "stackRoot",
                          "currentRevision",
                          "definition",
                          "createdAt",
                          "updatedAt",
                          "lastUsedAt"
                        ],
                        "type": "object"
                      }
                    },
                    "required": [
                      "stack",
                      "reasons"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "candidates": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "claimIds": {
                        "items": {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        "type": "array"
                      },
                      "reason": {
                        "const": "stack-root-missing",
                        "type": "string"
                      },
                      "stack": {
                        "additionalProperties": false,
                        "properties": {
                          "createdAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "currentRevision": {
                            "pattern": "^[a-f0-9]{64}$",
                            "type": "string"
                          },
                          "definition": {
                            "additionalProperties": false,
                            "properties": {
                              "components": {
                                "additionalProperties": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "dependencies": {
                                      "additionalProperties": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "component": {
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          },
                                          "endpoint": {
                                            "default": "default",
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          },
                                          "required": {
                                            "default": true,
                                            "type": "boolean"
                                          }
                                        },
                                        "required": [
                                          "component",
                                          "endpoint",
                                          "required"
                                        ],
                                        "type": "object"
                                      },
                                      "default": {},
                                      "propertyNames": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      },
                                      "type": "object"
                                    },
                                    "docker": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "service": {
                                          "maxLength": 128,
                                          "minLength": 1,
                                          "type": "string"
                                        }
                                      },
                                      "required": [
                                        "service"
                                      ],
                                      "type": "object"
                                    },
                                    "endpoints": {
                                      "additionalProperties": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "allocation": {
                                            "additionalProperties": false,
                                            "default": {},
                                            "properties": {
                                              "exactPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              },
                                              "preferredPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              }
                                            },
                                            "type": "object"
                                          },
                                          "docker": {
                                            "additionalProperties": false,
                                            "properties": {
                                              "containerPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              }
                                            },
                                            "required": [
                                              "containerPort"
                                            ],
                                            "type": "object"
                                          },
                                          "publish": {
                                            "default": true,
                                            "type": "boolean"
                                          },
                                          "required": {
                                            "default": true,
                                            "type": "boolean"
                                          },
                                          "transport": {
                                            "const": "tcp",
                                            "default": "tcp",
                                            "type": "string"
                                          }
                                        },
                                        "required": [
                                          "transport",
                                          "publish",
                                          "required",
                                          "allocation"
                                        ],
                                        "type": "object"
                                      },
                                      "default": {},
                                      "propertyNames": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      },
                                      "type": "object"
                                    }
                                  },
                                  "required": [
                                    "endpoints",
                                    "dependencies"
                                  ],
                                  "type": "object"
                                },
                                "propertyNames": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "type": "object"
                              },
                              "project": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              },
                              "version": {
                                "const": 1,
                                "type": "number"
                              }
                            },
                            "required": [
                              "version",
                              "project",
                              "components"
                            ],
                            "type": "object"
                          },
                          "id": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          "lastUsedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "project": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "stackRoot": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "updatedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "id",
                          "project",
                          "stackRoot",
                          "currentRevision",
                          "definition",
                          "createdAt",
                          "updatedAt",
                          "lastUsedAt"
                        ],
                        "type": "object"
                      }
                    },
                    "required": [
                      "stack",
                      "claimIds",
                      "reason"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "deletedClaimIds": {
                  "items": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "type": "array"
                },
                "deletedStackIds": {
                  "items": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "type": "array"
                },
                "dryRun": {
                  "type": "boolean"
                },
                "skipped": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "reason": {
                        "minLength": 1,
                        "type": "string"
                      },
                      "stackId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      }
                    },
                    "required": [
                      "stackId",
                      "reason"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                }
              },
              "required": [
                "dryRun",
                "candidates",
                "blocked",
                "deletedStackIds",
                "deletedClaimIds",
                "skipped"
              ],
              "type": "object"
            },
            "proposal": {
              "additionalProperties": false,
              "properties": {
                "olderThanMilliseconds": {
                  "maximum": 315576000000,
                  "minimum": 0,
                  "type": "integer"
                }
              },
              "required": [
                "olderThanMilliseconds"
              ],
              "type": "object"
            },
            "receiptId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "target": {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "minLength": 1,
                  "type": "string"
                },
                "type": {
                  "const": "stack-collection",
                  "type": "string"
                }
              },
              "required": [
                "type",
                "id"
              ],
              "type": "object"
            }
          },
          "required": [
            "receiptId",
            "action",
            "target",
            "proposal",
            "observed",
            "expiresAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stacks_prune_execute`

Prune only the stack candidate set whose process, Docker, launcher, and filesystem evidence still matches the receipt.

- **Title:** Execute stale-stack pruning
- **Family:** stacks
- **Safety:** consequential-mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive yes; idempotent yes; open-world no

#### Input schema for `portreeve_stacks_prune_execute`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "receiptId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "receiptId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stacks_prune_execute`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "replayed": {
              "type": "boolean"
            },
            "result": {
              "additionalProperties": false,
              "properties": {
                "blocked": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "reasons": {
                        "items": {
                          "minLength": 1,
                          "type": "string"
                        },
                        "minItems": 1,
                        "type": "array"
                      },
                      "stack": {
                        "additionalProperties": false,
                        "properties": {
                          "createdAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "currentRevision": {
                            "pattern": "^[a-f0-9]{64}$",
                            "type": "string"
                          },
                          "definition": {
                            "additionalProperties": false,
                            "properties": {
                              "components": {
                                "additionalProperties": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "dependencies": {
                                      "additionalProperties": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "component": {
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          },
                                          "endpoint": {
                                            "default": "default",
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          },
                                          "required": {
                                            "default": true,
                                            "type": "boolean"
                                          }
                                        },
                                        "required": [
                                          "component",
                                          "endpoint",
                                          "required"
                                        ],
                                        "type": "object"
                                      },
                                      "default": {},
                                      "propertyNames": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      },
                                      "type": "object"
                                    },
                                    "docker": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "service": {
                                          "maxLength": 128,
                                          "minLength": 1,
                                          "type": "string"
                                        }
                                      },
                                      "required": [
                                        "service"
                                      ],
                                      "type": "object"
                                    },
                                    "endpoints": {
                                      "additionalProperties": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "allocation": {
                                            "additionalProperties": false,
                                            "default": {},
                                            "properties": {
                                              "exactPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              },
                                              "preferredPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              }
                                            },
                                            "type": "object"
                                          },
                                          "docker": {
                                            "additionalProperties": false,
                                            "properties": {
                                              "containerPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              }
                                            },
                                            "required": [
                                              "containerPort"
                                            ],
                                            "type": "object"
                                          },
                                          "publish": {
                                            "default": true,
                                            "type": "boolean"
                                          },
                                          "required": {
                                            "default": true,
                                            "type": "boolean"
                                          },
                                          "transport": {
                                            "const": "tcp",
                                            "default": "tcp",
                                            "type": "string"
                                          }
                                        },
                                        "required": [
                                          "transport",
                                          "publish",
                                          "required",
                                          "allocation"
                                        ],
                                        "type": "object"
                                      },
                                      "default": {},
                                      "propertyNames": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      },
                                      "type": "object"
                                    }
                                  },
                                  "required": [
                                    "endpoints",
                                    "dependencies"
                                  ],
                                  "type": "object"
                                },
                                "propertyNames": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "type": "object"
                              },
                              "project": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              },
                              "version": {
                                "const": 1,
                                "type": "number"
                              }
                            },
                            "required": [
                              "version",
                              "project",
                              "components"
                            ],
                            "type": "object"
                          },
                          "id": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          "lastUsedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "project": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "stackRoot": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "updatedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "id",
                          "project",
                          "stackRoot",
                          "currentRevision",
                          "definition",
                          "createdAt",
                          "updatedAt",
                          "lastUsedAt"
                        ],
                        "type": "object"
                      }
                    },
                    "required": [
                      "stack",
                      "reasons"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "candidates": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "claimIds": {
                        "items": {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        "type": "array"
                      },
                      "reason": {
                        "const": "stack-root-missing",
                        "type": "string"
                      },
                      "stack": {
                        "additionalProperties": false,
                        "properties": {
                          "createdAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "currentRevision": {
                            "pattern": "^[a-f0-9]{64}$",
                            "type": "string"
                          },
                          "definition": {
                            "additionalProperties": false,
                            "properties": {
                              "components": {
                                "additionalProperties": {
                                  "additionalProperties": false,
                                  "properties": {
                                    "dependencies": {
                                      "additionalProperties": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "component": {
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          },
                                          "endpoint": {
                                            "default": "default",
                                            "maxLength": 128,
                                            "minLength": 1,
                                            "type": "string"
                                          },
                                          "required": {
                                            "default": true,
                                            "type": "boolean"
                                          }
                                        },
                                        "required": [
                                          "component",
                                          "endpoint",
                                          "required"
                                        ],
                                        "type": "object"
                                      },
                                      "default": {},
                                      "propertyNames": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      },
                                      "type": "object"
                                    },
                                    "docker": {
                                      "additionalProperties": false,
                                      "properties": {
                                        "service": {
                                          "maxLength": 128,
                                          "minLength": 1,
                                          "type": "string"
                                        }
                                      },
                                      "required": [
                                        "service"
                                      ],
                                      "type": "object"
                                    },
                                    "endpoints": {
                                      "additionalProperties": {
                                        "additionalProperties": false,
                                        "properties": {
                                          "allocation": {
                                            "additionalProperties": false,
                                            "default": {},
                                            "properties": {
                                              "exactPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              },
                                              "preferredPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              }
                                            },
                                            "type": "object"
                                          },
                                          "docker": {
                                            "additionalProperties": false,
                                            "properties": {
                                              "containerPort": {
                                                "maximum": 65535,
                                                "minimum": 1,
                                                "type": "integer"
                                              }
                                            },
                                            "required": [
                                              "containerPort"
                                            ],
                                            "type": "object"
                                          },
                                          "publish": {
                                            "default": true,
                                            "type": "boolean"
                                          },
                                          "required": {
                                            "default": true,
                                            "type": "boolean"
                                          },
                                          "transport": {
                                            "const": "tcp",
                                            "default": "tcp",
                                            "type": "string"
                                          }
                                        },
                                        "required": [
                                          "transport",
                                          "publish",
                                          "required",
                                          "allocation"
                                        ],
                                        "type": "object"
                                      },
                                      "default": {},
                                      "propertyNames": {
                                        "maxLength": 128,
                                        "minLength": 1,
                                        "type": "string"
                                      },
                                      "type": "object"
                                    }
                                  },
                                  "required": [
                                    "endpoints",
                                    "dependencies"
                                  ],
                                  "type": "object"
                                },
                                "propertyNames": {
                                  "maxLength": 128,
                                  "minLength": 1,
                                  "type": "string"
                                },
                                "type": "object"
                              },
                              "project": {
                                "maxLength": 128,
                                "minLength": 1,
                                "type": "string"
                              },
                              "version": {
                                "const": 1,
                                "type": "number"
                              }
                            },
                            "required": [
                              "version",
                              "project",
                              "components"
                            ],
                            "type": "object"
                          },
                          "id": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          "lastUsedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          "project": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "stackRoot": {
                            "minLength": 1,
                            "type": "string"
                          },
                          "updatedAt": {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "id",
                          "project",
                          "stackRoot",
                          "currentRevision",
                          "definition",
                          "createdAt",
                          "updatedAt",
                          "lastUsedAt"
                        ],
                        "type": "object"
                      }
                    },
                    "required": [
                      "stack",
                      "claimIds",
                      "reason"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "deletedClaimIds": {
                  "items": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "type": "array"
                },
                "deletedStackIds": {
                  "items": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "type": "array"
                },
                "dryRun": {
                  "type": "boolean"
                },
                "skipped": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "reason": {
                        "minLength": 1,
                        "type": "string"
                      },
                      "stackId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      }
                    },
                    "required": [
                      "stackId",
                      "reason"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                }
              },
              "required": [
                "dryRun",
                "candidates",
                "blocked",
                "deletedStackIds",
                "deletedClaimIds",
                "skipped"
              ],
              "type": "object"
            }
          },
          "required": [
            "changed",
            "replayed",
            "result"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_generation_get`

Read one stack generation by explicit identifier.

- **Title:** Get a generation
- **Family:** stacks
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_generation_get`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "id": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "id"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_generation_get`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "createdAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "endpoints": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "claimId": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "host": {
                    "const": "127.0.0.1",
                    "type": "string"
                  },
                  "port": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  },
                  "required": {
                    "type": "boolean"
                  },
                  "transport": {
                    "const": "tcp",
                    "type": "string"
                  }
                },
                "required": [
                  "claimId",
                  "component",
                  "endpoint",
                  "transport",
                  "host",
                  "port",
                  "required"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "id": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "invalidatedAt": {
              "anyOf": [
                {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "revision": {
              "pattern": "^[a-f0-9]{64}$",
              "type": "string"
            },
            "stackId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "state": {
              "enum": [
                "valid",
                "stale"
              ],
              "type": "string"
            }
          },
          "required": [
            "id",
            "stackId",
            "revision",
            "state",
            "endpoints",
            "createdAt",
            "invalidatedAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_generations_list`

List stack generations globally with explicit filters.

- **Title:** List generations
- **Family:** stacks
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_generations_list`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "afterCursor": {
      "minLength": 1,
      "type": "string"
    },
    "limit": {
      "default": 50,
      "maximum": 200,
      "minimum": 1,
      "type": "integer"
    },
    "stackId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "state": {
      "enum": [
        "valid",
        "stale"
      ],
      "type": "string"
    }
  },
  "required": [
    "limit"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_generations_list`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "items": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "createdAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "endpoints": {
                    "items": {
                      "additionalProperties": false,
                      "properties": {
                        "claimId": {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        "component": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "endpoint": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "host": {
                          "const": "127.0.0.1",
                          "type": "string"
                        },
                        "port": {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        "required": {
                          "type": "boolean"
                        },
                        "transport": {
                          "const": "tcp",
                          "type": "string"
                        }
                      },
                      "required": [
                        "claimId",
                        "component",
                        "endpoint",
                        "transport",
                        "host",
                        "port",
                        "required"
                      ],
                      "type": "object"
                    },
                    "type": "array"
                  },
                  "id": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "invalidatedAt": {
                    "anyOf": [
                      {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "revision": {
                    "pattern": "^[a-f0-9]{64}$",
                    "type": "string"
                  },
                  "stackId": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "state": {
                    "enum": [
                      "valid",
                      "stale"
                    ],
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "stackId",
                  "revision",
                  "state",
                  "endpoints",
                  "createdAt",
                  "invalidatedAt"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "page": {
              "additionalProperties": false,
              "properties": {
                "nextCursor": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "nextCursor"
              ],
              "type": "object"
            }
          },
          "required": [
            "items",
            "page"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_get`

Read one stack activation by explicit identifier.

- **Title:** Get an activation
- **Family:** activations
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_get`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "id": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "id"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activation_get`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "confirmedAt": {
              "anyOf": [
                {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "createdAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "endedAt": {
              "anyOf": [
                {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "endpoints": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "bindingKind": {
                    "enum": [
                      "process",
                      "docker"
                    ],
                    "type": "string"
                  },
                  "claimId": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "expiresAt": {
                    "anyOf": [
                      {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "failureReason": {
                    "anyOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "leaseId": {
                    "anyOf": [
                      {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "port": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  },
                  "required": {
                    "type": "boolean"
                  },
                  "runId": {
                    "anyOf": [
                      {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "state": {
                    "enum": [
                      "leased",
                      "confirmed",
                      "skipped",
                      "failed",
                      "released"
                    ],
                    "type": "string"
                  },
                  "updatedAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  }
                },
                "required": [
                  "component",
                  "endpoint",
                  "claimId",
                  "port",
                  "required",
                  "bindingKind",
                  "state",
                  "leaseId",
                  "runId",
                  "expiresAt",
                  "failureReason",
                  "updatedAt"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "generationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "id": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "stackId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "state": {
              "enum": [
                "starting",
                "confirmed",
                "degraded",
                "failed",
                "lost",
                "ended"
              ],
              "type": "string"
            },
            "updatedAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            }
          },
          "required": [
            "id",
            "stackId",
            "generationId",
            "state",
            "endpoints",
            "createdAt",
            "updatedAt",
            "confirmedAt",
            "endedAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activations_list`

List stack activations globally with explicit filters.

- **Title:** List activations
- **Family:** activations
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activations_list`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "afterCursor": {
      "minLength": 1,
      "type": "string"
    },
    "generationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "limit": {
      "default": 50,
      "maximum": 200,
      "minimum": 1,
      "type": "integer"
    },
    "stackId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "state": {
      "enum": [
        "starting",
        "confirmed",
        "degraded",
        "failed",
        "lost",
        "ended"
      ],
      "type": "string"
    }
  },
  "required": [
    "limit"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activations_list`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "items": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "confirmedAt": {
                    "anyOf": [
                      {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "createdAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "endedAt": {
                    "anyOf": [
                      {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "endpoints": {
                    "items": {
                      "additionalProperties": false,
                      "properties": {
                        "bindingKind": {
                          "enum": [
                            "process",
                            "docker"
                          ],
                          "type": "string"
                        },
                        "claimId": {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        "component": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "endpoint": {
                          "maxLength": 128,
                          "minLength": 1,
                          "type": "string"
                        },
                        "expiresAt": {
                          "anyOf": [
                            {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "failureReason": {
                          "anyOf": [
                            {
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "leaseId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "port": {
                          "maximum": 65535,
                          "minimum": 1,
                          "type": "integer"
                        },
                        "required": {
                          "type": "boolean"
                        },
                        "runId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "state": {
                          "enum": [
                            "leased",
                            "confirmed",
                            "skipped",
                            "failed",
                            "released"
                          ],
                          "type": "string"
                        },
                        "updatedAt": {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        }
                      },
                      "required": [
                        "component",
                        "endpoint",
                        "claimId",
                        "port",
                        "required",
                        "bindingKind",
                        "state",
                        "leaseId",
                        "runId",
                        "expiresAt",
                        "failureReason",
                        "updatedAt"
                      ],
                      "type": "object"
                    },
                    "type": "array"
                  },
                  "generationId": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "id": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "stackId": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "state": {
                    "enum": [
                      "starting",
                      "confirmed",
                      "degraded",
                      "failed",
                      "lost",
                      "ended"
                    ],
                    "type": "string"
                  },
                  "updatedAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "stackId",
                  "generationId",
                  "state",
                  "endpoints",
                  "createdAt",
                  "updatedAt",
                  "confirmedAt",
                  "endedAt"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "page": {
              "additionalProperties": false,
              "properties": {
                "nextCursor": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "nextCursor"
              ],
              "type": "object"
            }
          },
          "required": [
            "items",
            "page"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_begin`

Begin an activation and retain all pending endpoint credentials in bounded bridge custody.

- **Title:** Begin stack activation
- **Family:** activations
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_begin`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "bindings": {
      "additionalProperties": {
        "enum": [
          "process",
          "docker"
        ],
        "type": "string"
      },
      "default": {},
      "propertyNames": {
        "maxLength": 128,
        "minLength": 1,
        "type": "string"
      },
      "type": "object"
    },
    "generationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "requiredEndpoints": {
      "default": [],
      "items": {
        "additionalProperties": false,
        "properties": {
          "component": {
            "maxLength": 128,
            "minLength": 1,
            "type": "string"
          },
          "endpoint": {
            "default": "default",
            "maxLength": 128,
            "minLength": 1,
            "type": "string"
          }
        },
        "required": [
          "component",
          "endpoint"
        ],
        "type": "object"
      },
      "type": "array"
    },
    "skippedEndpoints": {
      "default": [],
      "items": {
        "additionalProperties": false,
        "properties": {
          "component": {
            "maxLength": 128,
            "minLength": 1,
            "type": "string"
          },
          "endpoint": {
            "default": "default",
            "maxLength": 128,
            "minLength": 1,
            "type": "string"
          }
        },
        "required": [
          "component",
          "endpoint"
        ],
        "type": "object"
      },
      "type": "array"
    }
  },
  "required": [
    "generationId",
    "requiredEndpoints",
    "skippedEndpoints",
    "bindings"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activation_begin`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activation": {
              "additionalProperties": false,
              "properties": {
                "confirmedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "endedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "endpoints": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "bindingKind": {
                        "enum": [
                          "process",
                          "docker"
                        ],
                        "type": "string"
                      },
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "component": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "endpoint": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "expiresAt": {
                        "anyOf": [
                          {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "failureReason": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "leaseId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "required": {
                        "type": "boolean"
                      },
                      "runId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "state": {
                        "enum": [
                          "leased",
                          "confirmed",
                          "skipped",
                          "failed",
                          "released"
                        ],
                        "type": "string"
                      },
                      "updatedAt": {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      }
                    },
                    "required": [
                      "component",
                      "endpoint",
                      "claimId",
                      "port",
                      "required",
                      "bindingKind",
                      "state",
                      "leaseId",
                      "runId",
                      "expiresAt",
                      "failureReason",
                      "updatedAt"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "generationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "starting",
                    "confirmed",
                    "degraded",
                    "failed",
                    "lost",
                    "ended"
                  ],
                  "type": "string"
                },
                "updatedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "generationId",
                "state",
                "endpoints",
                "createdAt",
                "updatedAt",
                "confirmedAt",
                "endedAt"
              ],
              "type": "object"
            },
            "changed": {
              "type": "boolean"
            },
            "credentialCount": {
              "maximum": 9007199254740991,
              "minimum": 0,
              "type": "integer"
            },
            "custodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "leases": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "bindingKind": {
                    "enum": [
                      "process",
                      "docker"
                    ],
                    "type": "string"
                  },
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "credentialHandle": {
                    "pattern": "^[A-Za-z0-9_-]{43}$",
                    "type": "string"
                  },
                  "custodyExpiresAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "docker": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "containerPort": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "requiredLabels": {
                            "additionalProperties": {
                              "type": "string"
                            },
                            "propertyNames": {
                              "type": "string"
                            },
                            "type": "object"
                          },
                          "service": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          }
                        },
                        "required": [
                          "service",
                          "containerPort",
                          "requiredLabels"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "leaseExpiresAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "leaseId": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "maximumCustodyExpiresAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "port": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  }
                },
                "required": [
                  "component",
                  "endpoint",
                  "leaseId",
                  "port",
                  "bindingKind",
                  "docker",
                  "credentialHandle",
                  "leaseExpiresAt",
                  "custodyExpiresAt",
                  "maximumCustodyExpiresAt"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "maximumCustodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            }
          },
          "required": [
            "changed",
            "activation",
            "leases",
            "custodyExpiresAt",
            "maximumCustodyExpiresAt",
            "credentialCount"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_custody_extend`

Extend this bridge custody for pending activation leases up to sixty minutes from acquisition.

- **Title:** Extend activation custody
- **Family:** activations
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_custody_extend`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "activationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "custodyMinutes": {
      "maximum": 60,
      "minimum": 10,
      "type": "integer"
    }
  },
  "required": [
    "activationId",
    "custodyMinutes"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activation_custody_extend`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "changed": {
              "type": "boolean"
            },
            "credentialCount": {
              "maximum": 9007199254740991,
              "minimum": 0,
              "type": "integer"
            },
            "custodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "maximumCustodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            }
          },
          "required": [
            "custodyExpiresAt",
            "maximumCustodyExpiresAt",
            "credentialCount",
            "changed",
            "activationId"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_resolve`

Resolve one component own and dependency addresses within an activation.

- **Title:** Resolve activation endpoints
- **Family:** activations
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_resolve`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "activationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "component": {
      "maxLength": 128,
      "minLength": 1,
      "type": "string"
    }
  },
  "required": [
    "activationId",
    "component"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activation_resolve`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "component": {
              "maxLength": 128,
              "minLength": 1,
              "type": "string"
            },
            "definitionRevision": {
              "pattern": "^[a-f0-9]{64}$",
              "type": "string"
            },
            "dependencies": {
              "additionalProperties": {
                "additionalProperties": false,
                "properties": {
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "dockerNetwork": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "host": {
                            "maxLength": 253,
                            "minLength": 1,
                            "type": "string"
                          },
                          "port": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "transport": {
                            "const": "tcp",
                            "type": "string"
                          }
                        },
                        "required": [
                          "transport",
                          "host",
                          "port"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "host": {
                    "additionalProperties": false,
                    "properties": {
                      "host": {
                        "maxLength": 253,
                        "minLength": 1,
                        "type": "string"
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "transport": {
                        "const": "tcp",
                        "type": "string"
                      }
                    },
                    "required": [
                      "transport",
                      "host",
                      "port"
                    ],
                    "type": "object"
                  }
                },
                "required": [
                  "component",
                  "endpoint",
                  "host",
                  "dockerNetwork"
                ],
                "type": "object"
              },
              "propertyNames": {
                "maxLength": 128,
                "minLength": 1,
                "type": "string"
              },
              "type": "object"
            },
            "generationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "own": {
              "additionalProperties": {
                "additionalProperties": false,
                "properties": {
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "dockerNetwork": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "host": {
                            "maxLength": 253,
                            "minLength": 1,
                            "type": "string"
                          },
                          "port": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "transport": {
                            "const": "tcp",
                            "type": "string"
                          }
                        },
                        "required": [
                          "transport",
                          "host",
                          "port"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "host": {
                    "additionalProperties": false,
                    "properties": {
                      "host": {
                        "maxLength": 253,
                        "minLength": 1,
                        "type": "string"
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "transport": {
                        "const": "tcp",
                        "type": "string"
                      }
                    },
                    "required": [
                      "transport",
                      "host",
                      "port"
                    ],
                    "type": "object"
                  }
                },
                "required": [
                  "component",
                  "endpoint",
                  "host",
                  "dockerNetwork"
                ],
                "type": "object"
              },
              "propertyNames": {
                "maxLength": 128,
                "minLength": 1,
                "type": "string"
              },
              "type": "object"
            },
            "schemaVersion": {
              "const": 1,
              "type": "number"
            }
          },
          "required": [
            "schemaVersion",
            "definitionRevision",
            "generationId",
            "activationId",
            "component",
            "own",
            "dependencies"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_confirm_endpoint`

Confirm process or Docker binding evidence using a credential held by this bridge.

- **Title:** Confirm an activation endpoint
- **Family:** activations
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_confirm_endpoint`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "anyOf": [
    {
      "additionalProperties": false,
      "properties": {
        "activationId": {
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
          "type": "string"
        },
        "bindingKind": {
          "const": "process",
          "type": "string"
        },
        "credentialHandle": {
          "pattern": "^[A-Za-z0-9_-]{43}$",
          "type": "string"
        },
        "rootPid": {
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991,
          "type": "integer"
        }
      },
      "required": [
        "activationId",
        "credentialHandle",
        "bindingKind",
        "rootPid"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "activationId": {
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
          "type": "string"
        },
        "bindingKind": {
          "const": "docker",
          "type": "string"
        },
        "containerId": {
          "pattern": "^[a-f0-9]{12,64}$",
          "type": "string"
        },
        "credentialHandle": {
          "pattern": "^[A-Za-z0-9_-]{43}$",
          "type": "string"
        }
      },
      "required": [
        "activationId",
        "credentialHandle",
        "bindingKind",
        "containerId"
      ],
      "type": "object"
    }
  ]
}
```

#### Structured output schema for `portreeve_activation_confirm_endpoint`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activation": {
              "additionalProperties": false,
              "properties": {
                "confirmedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "endedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "endpoints": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "bindingKind": {
                        "enum": [
                          "process",
                          "docker"
                        ],
                        "type": "string"
                      },
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "component": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "endpoint": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "expiresAt": {
                        "anyOf": [
                          {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "failureReason": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "leaseId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "required": {
                        "type": "boolean"
                      },
                      "runId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "state": {
                        "enum": [
                          "leased",
                          "confirmed",
                          "skipped",
                          "failed",
                          "released"
                        ],
                        "type": "string"
                      },
                      "updatedAt": {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      }
                    },
                    "required": [
                      "component",
                      "endpoint",
                      "claimId",
                      "port",
                      "required",
                      "bindingKind",
                      "state",
                      "leaseId",
                      "runId",
                      "expiresAt",
                      "failureReason",
                      "updatedAt"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "generationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "starting",
                    "confirmed",
                    "degraded",
                    "failed",
                    "lost",
                    "ended"
                  ],
                  "type": "string"
                },
                "updatedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "generationId",
                "state",
                "endpoints",
                "createdAt",
                "updatedAt",
                "confirmedAt",
                "endedAt"
              ],
              "type": "object"
            },
            "changed": {
              "type": "boolean"
            }
          },
          "required": [
            "changed",
            "activation"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_skip_endpoint`

Skip one optional activation endpoint and erase its held credential.

- **Title:** Skip an activation endpoint
- **Family:** activations
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_skip_endpoint`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "activationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "credentialHandle": {
      "pattern": "^[A-Za-z0-9_-]{43}$",
      "type": "string"
    }
  },
  "required": [
    "activationId",
    "credentialHandle"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activation_skip_endpoint`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activation": {
              "additionalProperties": false,
              "properties": {
                "confirmedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "endedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "endpoints": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "bindingKind": {
                        "enum": [
                          "process",
                          "docker"
                        ],
                        "type": "string"
                      },
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "component": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "endpoint": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "expiresAt": {
                        "anyOf": [
                          {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "failureReason": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "leaseId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "required": {
                        "type": "boolean"
                      },
                      "runId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "state": {
                        "enum": [
                          "leased",
                          "confirmed",
                          "skipped",
                          "failed",
                          "released"
                        ],
                        "type": "string"
                      },
                      "updatedAt": {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      }
                    },
                    "required": [
                      "component",
                      "endpoint",
                      "claimId",
                      "port",
                      "required",
                      "bindingKind",
                      "state",
                      "leaseId",
                      "runId",
                      "expiresAt",
                      "failureReason",
                      "updatedAt"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "generationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "starting",
                    "confirmed",
                    "degraded",
                    "failed",
                    "lost",
                    "ended"
                  ],
                  "type": "string"
                },
                "updatedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "generationId",
                "state",
                "endpoints",
                "createdAt",
                "updatedAt",
                "confirmedAt",
                "endedAt"
              ],
              "type": "object"
            },
            "changed": {
              "type": "boolean"
            }
          },
          "required": [
            "changed",
            "activation"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_abandon_endpoint`

Mark one activation endpoint failed and erase its held credential.

- **Title:** Abandon an activation endpoint
- **Family:** activations
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_abandon_endpoint`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "activationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "credentialHandle": {
      "pattern": "^[A-Za-z0-9_-]{43}$",
      "type": "string"
    },
    "reason": {
      "enum": [
        "address-in-use",
        "startup-error",
        "client-cancelled"
      ],
      "type": "string"
    }
  },
  "required": [
    "activationId",
    "credentialHandle",
    "reason"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activation_abandon_endpoint`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activation": {
              "additionalProperties": false,
              "properties": {
                "confirmedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "endedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "endpoints": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "bindingKind": {
                        "enum": [
                          "process",
                          "docker"
                        ],
                        "type": "string"
                      },
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "component": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "endpoint": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "expiresAt": {
                        "anyOf": [
                          {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "failureReason": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "leaseId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "required": {
                        "type": "boolean"
                      },
                      "runId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "state": {
                        "enum": [
                          "leased",
                          "confirmed",
                          "skipped",
                          "failed",
                          "released"
                        ],
                        "type": "string"
                      },
                      "updatedAt": {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      }
                    },
                    "required": [
                      "component",
                      "endpoint",
                      "claimId",
                      "port",
                      "required",
                      "bindingKind",
                      "state",
                      "leaseId",
                      "runId",
                      "expiresAt",
                      "failureReason",
                      "updatedAt"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "generationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "starting",
                    "confirmed",
                    "degraded",
                    "failed",
                    "lost",
                    "ended"
                  ],
                  "type": "string"
                },
                "updatedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "generationId",
                "state",
                "endpoints",
                "createdAt",
                "updatedAt",
                "confirmedAt",
                "endedAt"
              ],
              "type": "object"
            },
            "changed": {
              "type": "boolean"
            }
          },
          "required": [
            "changed",
            "activation"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_reconcile`

Refresh durable activation state from current provider evidence.

- **Title:** Reconcile an activation
- **Family:** activations
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_reconcile`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "activationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "activationId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activation_reconcile`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activation": {
              "additionalProperties": false,
              "properties": {
                "confirmedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "endedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "endpoints": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "bindingKind": {
                        "enum": [
                          "process",
                          "docker"
                        ],
                        "type": "string"
                      },
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "component": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "endpoint": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "expiresAt": {
                        "anyOf": [
                          {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "failureReason": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "leaseId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "required": {
                        "type": "boolean"
                      },
                      "runId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "state": {
                        "enum": [
                          "leased",
                          "confirmed",
                          "skipped",
                          "failed",
                          "released"
                        ],
                        "type": "string"
                      },
                      "updatedAt": {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      }
                    },
                    "required": [
                      "component",
                      "endpoint",
                      "claimId",
                      "port",
                      "required",
                      "bindingKind",
                      "state",
                      "leaseId",
                      "runId",
                      "expiresAt",
                      "failureReason",
                      "updatedAt"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "generationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "starting",
                    "confirmed",
                    "degraded",
                    "failed",
                    "lost",
                    "ended"
                  ],
                  "type": "string"
                },
                "updatedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "generationId",
                "state",
                "endpoints",
                "createdAt",
                "updatedAt",
                "confirmedAt",
                "endedAt"
              ],
              "type": "object"
            },
            "changed": {
              "type": "boolean"
            },
            "providers": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "bindingKind": {
                    "enum": [
                      "process",
                      "docker"
                    ],
                    "type": "string"
                  },
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "containerId": {
                    "anyOf": [
                      {
                        "maxLength": 64,
                        "minLength": 12,
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "listeners": {
                    "maximum": 9007199254740991,
                    "minimum": 0,
                    "type": "integer"
                  },
                  "port": {
                    "maximum": 65535,
                    "minimum": 1,
                    "type": "integer"
                  },
                  "reason": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "runId": {
                    "anyOf": [
                      {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "status": {
                    "enum": [
                      "active",
                      "gone",
                      "unknown"
                    ],
                    "type": "string"
                  }
                },
                "required": [
                  "component",
                  "endpoint",
                  "port",
                  "bindingKind",
                  "status",
                  "reason",
                  "listeners",
                  "runId",
                  "containerId"
                ],
                "type": "object"
              },
              "type": "array"
            }
          },
          "required": [
            "changed",
            "activation",
            "providers"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_activation_end`

End an activation after all endpoint leases and providers settle.

- **Title:** End an activation
- **Family:** activations
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_activation_end`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "activationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "activationId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_activation_end`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activation": {
              "additionalProperties": false,
              "properties": {
                "confirmedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "createdAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "endedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "endpoints": {
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "bindingKind": {
                        "enum": [
                          "process",
                          "docker"
                        ],
                        "type": "string"
                      },
                      "claimId": {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      "component": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "endpoint": {
                        "maxLength": 128,
                        "minLength": 1,
                        "type": "string"
                      },
                      "expiresAt": {
                        "anyOf": [
                          {
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "failureReason": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "leaseId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "required": {
                        "type": "boolean"
                      },
                      "runId": {
                        "anyOf": [
                          {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "state": {
                        "enum": [
                          "leased",
                          "confirmed",
                          "skipped",
                          "failed",
                          "released"
                        ],
                        "type": "string"
                      },
                      "updatedAt": {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      }
                    },
                    "required": [
                      "component",
                      "endpoint",
                      "claimId",
                      "port",
                      "required",
                      "bindingKind",
                      "state",
                      "leaseId",
                      "runId",
                      "expiresAt",
                      "failureReason",
                      "updatedAt"
                    ],
                    "type": "object"
                  },
                  "type": "array"
                },
                "generationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "starting",
                    "confirmed",
                    "degraded",
                    "failed",
                    "lost",
                    "ended"
                  ],
                  "type": "string"
                },
                "updatedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "generationId",
                "state",
                "endpoints",
                "createdAt",
                "updatedAt",
                "confirmedAt",
                "endedAt"
              ],
              "type": "object"
            },
            "changed": {
              "type": "boolean"
            }
          },
          "required": [
            "changed",
            "activation"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_stack_snapshot`

Return one structured redacted Docker-sandbox endpoint snapshot without writing a file.

- **Title:** Create a stack endpoint snapshot
- **Family:** stacks
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_stack_snapshot`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "activationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "component": {
      "maxLength": 128,
      "minLength": 1,
      "type": "string"
    },
    "gatewayHost": {
      "maxLength": 255,
      "minLength": 1,
      "type": "string"
    }
  },
  "required": [
    "activationId",
    "component",
    "gatewayHost"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_stack_snapshot`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "activationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "component": {
              "maxLength": 128,
              "minLength": 1,
              "type": "string"
            },
            "definitionRevision": {
              "pattern": "^[a-f0-9]{64}$",
              "type": "string"
            },
            "dependencies": {
              "additionalProperties": {
                "additionalProperties": false,
                "properties": {
                  "address": {
                    "additionalProperties": false,
                    "properties": {
                      "host": {
                        "maxLength": 253,
                        "minLength": 1,
                        "type": "string"
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "transport": {
                        "const": "tcp",
                        "type": "string"
                      }
                    },
                    "required": [
                      "transport",
                      "host",
                      "port"
                    ],
                    "type": "object"
                  },
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  }
                },
                "required": [
                  "component",
                  "endpoint",
                  "address"
                ],
                "type": "object"
              },
              "propertyNames": {
                "maxLength": 128,
                "minLength": 1,
                "type": "string"
              },
              "type": "object"
            },
            "generationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "own": {
              "additionalProperties": {
                "additionalProperties": false,
                "properties": {
                  "address": {
                    "additionalProperties": false,
                    "properties": {
                      "host": {
                        "maxLength": 253,
                        "minLength": 1,
                        "type": "string"
                      },
                      "port": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "transport": {
                        "const": "tcp",
                        "type": "string"
                      }
                    },
                    "required": [
                      "transport",
                      "host",
                      "port"
                    ],
                    "type": "object"
                  },
                  "component": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  },
                  "endpoint": {
                    "maxLength": 128,
                    "minLength": 1,
                    "type": "string"
                  }
                },
                "required": [
                  "component",
                  "endpoint",
                  "address"
                ],
                "type": "object"
              },
              "propertyNames": {
                "maxLength": 128,
                "minLength": 1,
                "type": "string"
              },
              "type": "object"
            },
            "schemaVersion": {
              "const": 1,
              "type": "number"
            }
          },
          "required": [
            "schemaVersion",
            "definitionRevision",
            "generationId",
            "activationId",
            "component",
            "own",
            "dependencies"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_launcher_operation_begin`

Begin one launcher operation without executing project commands and retain its credential behind an opaque bridge-local handle.

- **Title:** Begin launcher coordination
- **Family:** launchers
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_launcher_operation_begin`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "callerOperationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    },
    "executionMode": {
      "default": "finite",
      "enum": [
        "finite",
        "attached"
      ],
      "type": "string"
    },
    "generationId": {
      "anyOf": [
        {
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null
    },
    "launcherRevision": {
      "pattern": "^[a-f0-9]{64}$",
      "type": "string"
    },
    "operation": {
      "enum": [
        "start",
        "stop",
        "restart",
        "status"
      ],
      "type": "string"
    },
    "stackId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "stackId",
    "operation",
    "executionMode",
    "launcherRevision",
    "callerOperationId",
    "generationId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_launcher_operation_begin`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "credentialHandle": {
              "pattern": "^[A-Za-z0-9_-]{43}$",
              "type": "string"
            },
            "custodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "maximumCustodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "operation": {
              "additionalProperties": false,
              "properties": {
                "afterEvidence": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "classification": {
                          "enum": [
                            "stopped",
                            "partial",
                            "fully-observed",
                            "verified",
                            "conflicting",
                            "uncertain"
                          ],
                          "type": "string"
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "listenerCount": {
                          "maximum": 10000,
                          "minimum": 0,
                          "type": "integer"
                        },
                        "observedAt": {
                          "anyOf": [
                            {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "reasonCodes": {
                          "items": {
                            "maxLength": 64,
                            "minLength": 1,
                            "pattern": "^[a-z0-9_-]+$",
                            "type": "string"
                          },
                          "maxItems": 32,
                          "type": "array"
                        },
                        "source": {
                          "enum": [
                            "daemon",
                            "local",
                            "cached",
                            "unavailable"
                          ],
                          "type": "string"
                        }
                      },
                      "required": [
                        "classification",
                        "source",
                        "observedAt",
                        "generationId",
                        "activationId",
                        "listenerCount",
                        "reasonCodes"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "beforeEvidence": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "classification": {
                          "enum": [
                            "stopped",
                            "partial",
                            "fully-observed",
                            "verified",
                            "conflicting",
                            "uncertain"
                          ],
                          "type": "string"
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "listenerCount": {
                          "maximum": 10000,
                          "minimum": 0,
                          "type": "integer"
                        },
                        "observedAt": {
                          "anyOf": [
                            {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "reasonCodes": {
                          "items": {
                            "maxLength": 64,
                            "minLength": 1,
                            "pattern": "^[a-z0-9_-]+$",
                            "type": "string"
                          },
                          "maxItems": 32,
                          "type": "array"
                        },
                        "source": {
                          "enum": [
                            "daemon",
                            "local",
                            "cached",
                            "unavailable"
                          ],
                          "type": "string"
                        }
                      },
                      "required": [
                        "classification",
                        "source",
                        "observedAt",
                        "generationId",
                        "activationId",
                        "listenerCount",
                        "reasonCodes"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "callerOperationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "completedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "deadlineAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "degraded": {
                  "type": "boolean"
                },
                "durationMilliseconds": {
                  "anyOf": [
                    {
                      "maximum": 9007199254740991,
                      "minimum": 0,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "executionMode": {
                  "enum": [
                    "finite",
                    "attached"
                  ],
                  "type": "string"
                },
                "exitCode": {
                  "anyOf": [
                    {
                      "maximum": 255,
                      "minimum": 0,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "failure": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "code": {
                          "maxLength": 64,
                          "minLength": 1,
                          "pattern": "^[a-z0-9_-]+$",
                          "type": "string"
                        },
                        "message": {
                          "maxLength": 1024,
                          "minLength": 1,
                          "type": "string"
                        },
                        "step": {
                          "maxLength": 64,
                          "minLength": 1,
                          "pattern": "^[a-z0-9_-]+$",
                          "type": "string"
                        }
                      },
                      "required": [
                        "step",
                        "code",
                        "message"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "generationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "integration": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "mode": {
                          "enum": [
                            "command-only",
                            "verified-activation"
                          ],
                          "type": "string"
                        },
                        "upgradeSuggested": {
                          "type": "boolean"
                        },
                        "verified": {
                          "type": "boolean"
                        }
                      },
                      "required": [
                        "mode",
                        "verified",
                        "upgradeSuggested",
                        "generationId",
                        "activationId"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "launcherRevision": {
                  "pattern": "^[a-f0-9]{64}$",
                  "type": "string"
                },
                "operation": {
                  "enum": [
                    "start",
                    "stop",
                    "restart",
                    "status"
                  ],
                  "type": "string"
                },
                "outcome": {
                  "anyOf": [
                    {
                      "enum": [
                        "succeeded",
                        "failed",
                        "cancelled",
                        "timed-out",
                        "lost"
                      ],
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "renewedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "signal": {
                  "anyOf": [
                    {
                      "maxLength": 32,
                      "minLength": 4,
                      "pattern": "^SIG[A-Z0-9]+$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackRoot": {
                  "minLength": 1,
                  "type": "string"
                },
                "startedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "active",
                    "terminal"
                  ],
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "stackRoot",
                "operation",
                "executionMode",
                "launcherRevision",
                "callerOperationId",
                "generationId",
                "state",
                "outcome",
                "deadlineAt",
                "startedAt",
                "renewedAt",
                "completedAt",
                "durationMilliseconds",
                "exitCode",
                "signal",
                "degraded",
                "beforeEvidence",
                "afterEvidence",
                "failure",
                "integration"
              ],
              "type": "object"
            },
            "operationDeadlineAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "operationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "renewAfterMilliseconds": {
              "const": 10000,
              "type": "number"
            }
          },
          "required": [
            "credentialHandle",
            "operationId",
            "operationDeadlineAt",
            "custodyExpiresAt",
            "maximumCustodyExpiresAt",
            "changed",
            "operation",
            "renewAfterMilliseconds"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_launcher_operation_renew`

Refresh one launcher operation held by this bridge and optionally extend total custody up to sixty minutes.

- **Title:** Renew launcher coordination
- **Family:** launchers
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_launcher_operation_renew`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "credentialHandle": {
      "pattern": "^[A-Za-z0-9_-]{43}$",
      "type": "string"
    },
    "custodyMinutes": {
      "maximum": 60,
      "minimum": 10,
      "type": "integer"
    },
    "operationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "operationId",
    "credentialHandle"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_launcher_operation_renew`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "credentialHandle": {
              "pattern": "^[A-Za-z0-9_-]{43}$",
              "type": "string"
            },
            "custodyChanged": {
              "type": "boolean"
            },
            "custodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "maximumCustodyExpiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "operation": {
              "additionalProperties": false,
              "properties": {
                "afterEvidence": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "classification": {
                          "enum": [
                            "stopped",
                            "partial",
                            "fully-observed",
                            "verified",
                            "conflicting",
                            "uncertain"
                          ],
                          "type": "string"
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "listenerCount": {
                          "maximum": 10000,
                          "minimum": 0,
                          "type": "integer"
                        },
                        "observedAt": {
                          "anyOf": [
                            {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "reasonCodes": {
                          "items": {
                            "maxLength": 64,
                            "minLength": 1,
                            "pattern": "^[a-z0-9_-]+$",
                            "type": "string"
                          },
                          "maxItems": 32,
                          "type": "array"
                        },
                        "source": {
                          "enum": [
                            "daemon",
                            "local",
                            "cached",
                            "unavailable"
                          ],
                          "type": "string"
                        }
                      },
                      "required": [
                        "classification",
                        "source",
                        "observedAt",
                        "generationId",
                        "activationId",
                        "listenerCount",
                        "reasonCodes"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "beforeEvidence": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "classification": {
                          "enum": [
                            "stopped",
                            "partial",
                            "fully-observed",
                            "verified",
                            "conflicting",
                            "uncertain"
                          ],
                          "type": "string"
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "listenerCount": {
                          "maximum": 10000,
                          "minimum": 0,
                          "type": "integer"
                        },
                        "observedAt": {
                          "anyOf": [
                            {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "reasonCodes": {
                          "items": {
                            "maxLength": 64,
                            "minLength": 1,
                            "pattern": "^[a-z0-9_-]+$",
                            "type": "string"
                          },
                          "maxItems": 32,
                          "type": "array"
                        },
                        "source": {
                          "enum": [
                            "daemon",
                            "local",
                            "cached",
                            "unavailable"
                          ],
                          "type": "string"
                        }
                      },
                      "required": [
                        "classification",
                        "source",
                        "observedAt",
                        "generationId",
                        "activationId",
                        "listenerCount",
                        "reasonCodes"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "callerOperationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "completedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "deadlineAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "degraded": {
                  "type": "boolean"
                },
                "durationMilliseconds": {
                  "anyOf": [
                    {
                      "maximum": 9007199254740991,
                      "minimum": 0,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "executionMode": {
                  "enum": [
                    "finite",
                    "attached"
                  ],
                  "type": "string"
                },
                "exitCode": {
                  "anyOf": [
                    {
                      "maximum": 255,
                      "minimum": 0,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "failure": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "code": {
                          "maxLength": 64,
                          "minLength": 1,
                          "pattern": "^[a-z0-9_-]+$",
                          "type": "string"
                        },
                        "message": {
                          "maxLength": 1024,
                          "minLength": 1,
                          "type": "string"
                        },
                        "step": {
                          "maxLength": 64,
                          "minLength": 1,
                          "pattern": "^[a-z0-9_-]+$",
                          "type": "string"
                        }
                      },
                      "required": [
                        "step",
                        "code",
                        "message"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "generationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "integration": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "mode": {
                          "enum": [
                            "command-only",
                            "verified-activation"
                          ],
                          "type": "string"
                        },
                        "upgradeSuggested": {
                          "type": "boolean"
                        },
                        "verified": {
                          "type": "boolean"
                        }
                      },
                      "required": [
                        "mode",
                        "verified",
                        "upgradeSuggested",
                        "generationId",
                        "activationId"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "launcherRevision": {
                  "pattern": "^[a-f0-9]{64}$",
                  "type": "string"
                },
                "operation": {
                  "enum": [
                    "start",
                    "stop",
                    "restart",
                    "status"
                  ],
                  "type": "string"
                },
                "outcome": {
                  "anyOf": [
                    {
                      "enum": [
                        "succeeded",
                        "failed",
                        "cancelled",
                        "timed-out",
                        "lost"
                      ],
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "renewedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "signal": {
                  "anyOf": [
                    {
                      "maxLength": 32,
                      "minLength": 4,
                      "pattern": "^SIG[A-Z0-9]+$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackRoot": {
                  "minLength": 1,
                  "type": "string"
                },
                "startedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "active",
                    "terminal"
                  ],
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "stackRoot",
                "operation",
                "executionMode",
                "launcherRevision",
                "callerOperationId",
                "generationId",
                "state",
                "outcome",
                "deadlineAt",
                "startedAt",
                "renewedAt",
                "completedAt",
                "durationMilliseconds",
                "exitCode",
                "signal",
                "degraded",
                "beforeEvidence",
                "afterEvidence",
                "failure",
                "integration"
              ],
              "type": "object"
            },
            "operationDeadlineAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "operationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "renewAfterMilliseconds": {
              "const": 10000,
              "type": "number"
            }
          },
          "required": [
            "credentialHandle",
            "operationId",
            "operationDeadlineAt",
            "custodyExpiresAt",
            "maximumCustodyExpiresAt",
            "changed",
            "operation",
            "renewAfterMilliseconds",
            "custodyChanged"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_launcher_operation_complete`

Complete one launcher operation held by this bridge and erase its credential immediately.

- **Title:** Complete launcher coordination
- **Family:** launchers
- **Safety:** mutation
- **Receipt-bound:** no
- **Bridge credential custody:** yes
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_launcher_operation_complete`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "completion": {
      "additionalProperties": false,
      "properties": {
        "afterEvidence": {
          "anyOf": [
            {
              "additionalProperties": false,
              "properties": {
                "activationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "classification": {
                  "enum": [
                    "stopped",
                    "partial",
                    "fully-observed",
                    "verified",
                    "conflicting",
                    "uncertain"
                  ],
                  "type": "string"
                },
                "generationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "listenerCount": {
                  "maximum": 10000,
                  "minimum": 0,
                  "type": "integer"
                },
                "observedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "reasonCodes": {
                  "items": {
                    "maxLength": 64,
                    "minLength": 1,
                    "pattern": "^[a-z0-9_-]+$",
                    "type": "string"
                  },
                  "maxItems": 32,
                  "type": "array"
                },
                "source": {
                  "enum": [
                    "daemon",
                    "local",
                    "cached",
                    "unavailable"
                  ],
                  "type": "string"
                }
              },
              "required": [
                "classification",
                "source",
                "observedAt",
                "generationId",
                "activationId",
                "listenerCount",
                "reasonCodes"
              ],
              "type": "object"
            },
            {
              "type": "null"
            }
          ],
          "default": null
        },
        "beforeEvidence": {
          "anyOf": [
            {
              "additionalProperties": false,
              "properties": {
                "activationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "classification": {
                  "enum": [
                    "stopped",
                    "partial",
                    "fully-observed",
                    "verified",
                    "conflicting",
                    "uncertain"
                  ],
                  "type": "string"
                },
                "generationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "listenerCount": {
                  "maximum": 10000,
                  "minimum": 0,
                  "type": "integer"
                },
                "observedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "reasonCodes": {
                  "items": {
                    "maxLength": 64,
                    "minLength": 1,
                    "pattern": "^[a-z0-9_-]+$",
                    "type": "string"
                  },
                  "maxItems": 32,
                  "type": "array"
                },
                "source": {
                  "enum": [
                    "daemon",
                    "local",
                    "cached",
                    "unavailable"
                  ],
                  "type": "string"
                }
              },
              "required": [
                "classification",
                "source",
                "observedAt",
                "generationId",
                "activationId",
                "listenerCount",
                "reasonCodes"
              ],
              "type": "object"
            },
            {
              "type": "null"
            }
          ],
          "default": null
        },
        "degraded": {
          "default": false,
          "type": "boolean"
        },
        "exitCode": {
          "anyOf": [
            {
              "maximum": 255,
              "minimum": 0,
              "type": "integer"
            },
            {
              "type": "null"
            }
          ],
          "default": null
        },
        "failure": {
          "anyOf": [
            {
              "additionalProperties": false,
              "properties": {
                "code": {
                  "maxLength": 64,
                  "minLength": 1,
                  "pattern": "^[a-z0-9_-]+$",
                  "type": "string"
                },
                "message": {
                  "maxLength": 1024,
                  "minLength": 1,
                  "type": "string"
                },
                "step": {
                  "maxLength": 64,
                  "minLength": 1,
                  "pattern": "^[a-z0-9_-]+$",
                  "type": "string"
                }
              },
              "required": [
                "step",
                "code",
                "message"
              ],
              "type": "object"
            },
            {
              "type": "null"
            }
          ],
          "default": null
        },
        "integration": {
          "anyOf": [
            {
              "additionalProperties": false,
              "properties": {
                "activationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "generationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "mode": {
                  "enum": [
                    "command-only",
                    "verified-activation"
                  ],
                  "type": "string"
                },
                "upgradeSuggested": {
                  "type": "boolean"
                },
                "verified": {
                  "type": "boolean"
                }
              },
              "required": [
                "mode",
                "verified",
                "upgradeSuggested",
                "generationId",
                "activationId"
              ],
              "type": "object"
            },
            {
              "type": "null"
            }
          ],
          "default": null
        },
        "outcome": {
          "enum": [
            "succeeded",
            "failed",
            "cancelled",
            "timed-out"
          ],
          "type": "string"
        },
        "signal": {
          "anyOf": [
            {
              "maxLength": 32,
              "minLength": 4,
              "pattern": "^SIG[A-Z0-9]+$",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "default": null
        }
      },
      "required": [
        "outcome",
        "exitCode",
        "signal",
        "degraded",
        "beforeEvidence",
        "afterEvidence",
        "failure",
        "integration"
      ],
      "type": "object"
    },
    "credentialHandle": {
      "pattern": "^[A-Za-z0-9_-]{43}$",
      "type": "string"
    },
    "operationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "operationId",
    "credentialHandle",
    "completion"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_launcher_operation_complete`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "operation": {
              "additionalProperties": false,
              "properties": {
                "afterEvidence": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "classification": {
                          "enum": [
                            "stopped",
                            "partial",
                            "fully-observed",
                            "verified",
                            "conflicting",
                            "uncertain"
                          ],
                          "type": "string"
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "listenerCount": {
                          "maximum": 10000,
                          "minimum": 0,
                          "type": "integer"
                        },
                        "observedAt": {
                          "anyOf": [
                            {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "reasonCodes": {
                          "items": {
                            "maxLength": 64,
                            "minLength": 1,
                            "pattern": "^[a-z0-9_-]+$",
                            "type": "string"
                          },
                          "maxItems": 32,
                          "type": "array"
                        },
                        "source": {
                          "enum": [
                            "daemon",
                            "local",
                            "cached",
                            "unavailable"
                          ],
                          "type": "string"
                        }
                      },
                      "required": [
                        "classification",
                        "source",
                        "observedAt",
                        "generationId",
                        "activationId",
                        "listenerCount",
                        "reasonCodes"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "beforeEvidence": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "classification": {
                          "enum": [
                            "stopped",
                            "partial",
                            "fully-observed",
                            "verified",
                            "conflicting",
                            "uncertain"
                          ],
                          "type": "string"
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "listenerCount": {
                          "maximum": 10000,
                          "minimum": 0,
                          "type": "integer"
                        },
                        "observedAt": {
                          "anyOf": [
                            {
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "reasonCodes": {
                          "items": {
                            "maxLength": 64,
                            "minLength": 1,
                            "pattern": "^[a-z0-9_-]+$",
                            "type": "string"
                          },
                          "maxItems": 32,
                          "type": "array"
                        },
                        "source": {
                          "enum": [
                            "daemon",
                            "local",
                            "cached",
                            "unavailable"
                          ],
                          "type": "string"
                        }
                      },
                      "required": [
                        "classification",
                        "source",
                        "observedAt",
                        "generationId",
                        "activationId",
                        "listenerCount",
                        "reasonCodes"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "callerOperationId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "completedAt": {
                  "anyOf": [
                    {
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "deadlineAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "degraded": {
                  "type": "boolean"
                },
                "durationMilliseconds": {
                  "anyOf": [
                    {
                      "maximum": 9007199254740991,
                      "minimum": 0,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "executionMode": {
                  "enum": [
                    "finite",
                    "attached"
                  ],
                  "type": "string"
                },
                "exitCode": {
                  "anyOf": [
                    {
                      "maximum": 255,
                      "minimum": 0,
                      "type": "integer"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "failure": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "code": {
                          "maxLength": 64,
                          "minLength": 1,
                          "pattern": "^[a-z0-9_-]+$",
                          "type": "string"
                        },
                        "message": {
                          "maxLength": 1024,
                          "minLength": 1,
                          "type": "string"
                        },
                        "step": {
                          "maxLength": 64,
                          "minLength": 1,
                          "pattern": "^[a-z0-9_-]+$",
                          "type": "string"
                        }
                      },
                      "required": [
                        "step",
                        "code",
                        "message"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "generationId": {
                  "anyOf": [
                    {
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "id": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "integration": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "activationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "generationId": {
                          "anyOf": [
                            {
                              "format": "uuid",
                              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "mode": {
                          "enum": [
                            "command-only",
                            "verified-activation"
                          ],
                          "type": "string"
                        },
                        "upgradeSuggested": {
                          "type": "boolean"
                        },
                        "verified": {
                          "type": "boolean"
                        }
                      },
                      "required": [
                        "mode",
                        "verified",
                        "upgradeSuggested",
                        "generationId",
                        "activationId"
                      ],
                      "type": "object"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "launcherRevision": {
                  "pattern": "^[a-f0-9]{64}$",
                  "type": "string"
                },
                "operation": {
                  "enum": [
                    "start",
                    "stop",
                    "restart",
                    "status"
                  ],
                  "type": "string"
                },
                "outcome": {
                  "anyOf": [
                    {
                      "enum": [
                        "succeeded",
                        "failed",
                        "cancelled",
                        "timed-out",
                        "lost"
                      ],
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "renewedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "signal": {
                  "anyOf": [
                    {
                      "maxLength": 32,
                      "minLength": 4,
                      "pattern": "^SIG[A-Z0-9]+$",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "stackId": {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                "stackRoot": {
                  "minLength": 1,
                  "type": "string"
                },
                "startedAt": {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                "state": {
                  "enum": [
                    "active",
                    "terminal"
                  ],
                  "type": "string"
                }
              },
              "required": [
                "id",
                "stackId",
                "stackRoot",
                "operation",
                "executionMode",
                "launcherRevision",
                "callerOperationId",
                "generationId",
                "state",
                "outcome",
                "deadlineAt",
                "startedAt",
                "renewedAt",
                "completedAt",
                "durationMilliseconds",
                "exitCode",
                "signal",
                "degraded",
                "beforeEvidence",
                "afterEvidence",
                "failure",
                "integration"
              ],
              "type": "object"
            }
          },
          "required": [
            "changed",
            "operation"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_launcher_operation_get`

Read one launcher operation by explicit durable identifier.

- **Title:** Get launcher coordination
- **Family:** launchers
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_launcher_operation_get`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "operationId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "operationId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_launcher_operation_get`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "afterEvidence": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "activationId": {
                      "anyOf": [
                        {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "classification": {
                      "enum": [
                        "stopped",
                        "partial",
                        "fully-observed",
                        "verified",
                        "conflicting",
                        "uncertain"
                      ],
                      "type": "string"
                    },
                    "generationId": {
                      "anyOf": [
                        {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "listenerCount": {
                      "maximum": 10000,
                      "minimum": 0,
                      "type": "integer"
                    },
                    "observedAt": {
                      "anyOf": [
                        {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "reasonCodes": {
                      "items": {
                        "maxLength": 64,
                        "minLength": 1,
                        "pattern": "^[a-z0-9_-]+$",
                        "type": "string"
                      },
                      "maxItems": 32,
                      "type": "array"
                    },
                    "source": {
                      "enum": [
                        "daemon",
                        "local",
                        "cached",
                        "unavailable"
                      ],
                      "type": "string"
                    }
                  },
                  "required": [
                    "classification",
                    "source",
                    "observedAt",
                    "generationId",
                    "activationId",
                    "listenerCount",
                    "reasonCodes"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "beforeEvidence": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "activationId": {
                      "anyOf": [
                        {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "classification": {
                      "enum": [
                        "stopped",
                        "partial",
                        "fully-observed",
                        "verified",
                        "conflicting",
                        "uncertain"
                      ],
                      "type": "string"
                    },
                    "generationId": {
                      "anyOf": [
                        {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "listenerCount": {
                      "maximum": 10000,
                      "minimum": 0,
                      "type": "integer"
                    },
                    "observedAt": {
                      "anyOf": [
                        {
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "reasonCodes": {
                      "items": {
                        "maxLength": 64,
                        "minLength": 1,
                        "pattern": "^[a-z0-9_-]+$",
                        "type": "string"
                      },
                      "maxItems": 32,
                      "type": "array"
                    },
                    "source": {
                      "enum": [
                        "daemon",
                        "local",
                        "cached",
                        "unavailable"
                      ],
                      "type": "string"
                    }
                  },
                  "required": [
                    "classification",
                    "source",
                    "observedAt",
                    "generationId",
                    "activationId",
                    "listenerCount",
                    "reasonCodes"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "callerOperationId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "completedAt": {
              "anyOf": [
                {
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "deadlineAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "degraded": {
              "type": "boolean"
            },
            "durationMilliseconds": {
              "anyOf": [
                {
                  "maximum": 9007199254740991,
                  "minimum": 0,
                  "type": "integer"
                },
                {
                  "type": "null"
                }
              ]
            },
            "executionMode": {
              "enum": [
                "finite",
                "attached"
              ],
              "type": "string"
            },
            "exitCode": {
              "anyOf": [
                {
                  "maximum": 255,
                  "minimum": 0,
                  "type": "integer"
                },
                {
                  "type": "null"
                }
              ]
            },
            "failure": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "code": {
                      "maxLength": 64,
                      "minLength": 1,
                      "pattern": "^[a-z0-9_-]+$",
                      "type": "string"
                    },
                    "message": {
                      "maxLength": 1024,
                      "minLength": 1,
                      "type": "string"
                    },
                    "step": {
                      "maxLength": 64,
                      "minLength": 1,
                      "pattern": "^[a-z0-9_-]+$",
                      "type": "string"
                    }
                  },
                  "required": [
                    "step",
                    "code",
                    "message"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "generationId": {
              "anyOf": [
                {
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "id": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "integration": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "activationId": {
                      "anyOf": [
                        {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "generationId": {
                      "anyOf": [
                        {
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                          "type": "string"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "mode": {
                      "enum": [
                        "command-only",
                        "verified-activation"
                      ],
                      "type": "string"
                    },
                    "upgradeSuggested": {
                      "type": "boolean"
                    },
                    "verified": {
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "mode",
                    "verified",
                    "upgradeSuggested",
                    "generationId",
                    "activationId"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "launcherRevision": {
              "pattern": "^[a-f0-9]{64}$",
              "type": "string"
            },
            "operation": {
              "enum": [
                "start",
                "stop",
                "restart",
                "status"
              ],
              "type": "string"
            },
            "outcome": {
              "anyOf": [
                {
                  "enum": [
                    "succeeded",
                    "failed",
                    "cancelled",
                    "timed-out",
                    "lost"
                  ],
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "renewedAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "signal": {
              "anyOf": [
                {
                  "maxLength": 32,
                  "minLength": 4,
                  "pattern": "^SIG[A-Z0-9]+$",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ]
            },
            "stackId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "stackRoot": {
              "minLength": 1,
              "type": "string"
            },
            "startedAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "state": {
              "enum": [
                "active",
                "terminal"
              ],
              "type": "string"
            }
          },
          "required": [
            "id",
            "stackId",
            "stackRoot",
            "operation",
            "executionMode",
            "launcherRevision",
            "callerOperationId",
            "generationId",
            "state",
            "outcome",
            "deadlineAt",
            "startedAt",
            "renewedAt",
            "completedAt",
            "durationMilliseconds",
            "exitCode",
            "signal",
            "degraded",
            "beforeEvidence",
            "afterEvidence",
            "failure",
            "integration"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_launcher_operations_list`

Read the daemon-bounded launcher operation history for one explicit stack using opaque cursor pagination.

- **Title:** List launcher coordination history
- **Family:** launchers
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_launcher_operations_list`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "afterCursor": {
      "minLength": 1,
      "type": "string"
    },
    "limit": {
      "default": 20,
      "maximum": 20,
      "minimum": 1,
      "type": "integer"
    },
    "stackId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "stackId",
    "limit"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_launcher_operations_list`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "items": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "afterEvidence": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "activationId": {
                            "anyOf": [
                              {
                                "format": "uuid",
                                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "classification": {
                            "enum": [
                              "stopped",
                              "partial",
                              "fully-observed",
                              "verified",
                              "conflicting",
                              "uncertain"
                            ],
                            "type": "string"
                          },
                          "generationId": {
                            "anyOf": [
                              {
                                "format": "uuid",
                                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "listenerCount": {
                            "maximum": 10000,
                            "minimum": 0,
                            "type": "integer"
                          },
                          "observedAt": {
                            "anyOf": [
                              {
                                "format": "date-time",
                                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "reasonCodes": {
                            "items": {
                              "maxLength": 64,
                              "minLength": 1,
                              "pattern": "^[a-z0-9_-]+$",
                              "type": "string"
                            },
                            "maxItems": 32,
                            "type": "array"
                          },
                          "source": {
                            "enum": [
                              "daemon",
                              "local",
                              "cached",
                              "unavailable"
                            ],
                            "type": "string"
                          }
                        },
                        "required": [
                          "classification",
                          "source",
                          "observedAt",
                          "generationId",
                          "activationId",
                          "listenerCount",
                          "reasonCodes"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "beforeEvidence": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "activationId": {
                            "anyOf": [
                              {
                                "format": "uuid",
                                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "classification": {
                            "enum": [
                              "stopped",
                              "partial",
                              "fully-observed",
                              "verified",
                              "conflicting",
                              "uncertain"
                            ],
                            "type": "string"
                          },
                          "generationId": {
                            "anyOf": [
                              {
                                "format": "uuid",
                                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "listenerCount": {
                            "maximum": 10000,
                            "minimum": 0,
                            "type": "integer"
                          },
                          "observedAt": {
                            "anyOf": [
                              {
                                "format": "date-time",
                                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "reasonCodes": {
                            "items": {
                              "maxLength": 64,
                              "minLength": 1,
                              "pattern": "^[a-z0-9_-]+$",
                              "type": "string"
                            },
                            "maxItems": 32,
                            "type": "array"
                          },
                          "source": {
                            "enum": [
                              "daemon",
                              "local",
                              "cached",
                              "unavailable"
                            ],
                            "type": "string"
                          }
                        },
                        "required": [
                          "classification",
                          "source",
                          "observedAt",
                          "generationId",
                          "activationId",
                          "listenerCount",
                          "reasonCodes"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "callerOperationId": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "completedAt": {
                    "anyOf": [
                      {
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "deadlineAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "degraded": {
                    "type": "boolean"
                  },
                  "durationMilliseconds": {
                    "anyOf": [
                      {
                        "maximum": 9007199254740991,
                        "minimum": 0,
                        "type": "integer"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "executionMode": {
                    "enum": [
                      "finite",
                      "attached"
                    ],
                    "type": "string"
                  },
                  "exitCode": {
                    "anyOf": [
                      {
                        "maximum": 255,
                        "minimum": 0,
                        "type": "integer"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "failure": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "code": {
                            "maxLength": 64,
                            "minLength": 1,
                            "pattern": "^[a-z0-9_-]+$",
                            "type": "string"
                          },
                          "message": {
                            "maxLength": 1024,
                            "minLength": 1,
                            "type": "string"
                          },
                          "step": {
                            "maxLength": 64,
                            "minLength": 1,
                            "pattern": "^[a-z0-9_-]+$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "step",
                          "code",
                          "message"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "generationId": {
                    "anyOf": [
                      {
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "id": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "integration": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "activationId": {
                            "anyOf": [
                              {
                                "format": "uuid",
                                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "generationId": {
                            "anyOf": [
                              {
                                "format": "uuid",
                                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                                "type": "string"
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "mode": {
                            "enum": [
                              "command-only",
                              "verified-activation"
                            ],
                            "type": "string"
                          },
                          "upgradeSuggested": {
                            "type": "boolean"
                          },
                          "verified": {
                            "type": "boolean"
                          }
                        },
                        "required": [
                          "mode",
                          "verified",
                          "upgradeSuggested",
                          "generationId",
                          "activationId"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "launcherRevision": {
                    "pattern": "^[a-f0-9]{64}$",
                    "type": "string"
                  },
                  "operation": {
                    "enum": [
                      "start",
                      "stop",
                      "restart",
                      "status"
                    ],
                    "type": "string"
                  },
                  "outcome": {
                    "anyOf": [
                      {
                        "enum": [
                          "succeeded",
                          "failed",
                          "cancelled",
                          "timed-out",
                          "lost"
                        ],
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "renewedAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "signal": {
                    "anyOf": [
                      {
                        "maxLength": 32,
                        "minLength": 4,
                        "pattern": "^SIG[A-Z0-9]+$",
                        "type": "string"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "stackId": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "stackRoot": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "startedAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "state": {
                    "enum": [
                      "active",
                      "terminal"
                    ],
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "stackId",
                  "stackRoot",
                  "operation",
                  "executionMode",
                  "launcherRevision",
                  "callerOperationId",
                  "generationId",
                  "state",
                  "outcome",
                  "deadlineAt",
                  "startedAt",
                  "renewedAt",
                  "completedAt",
                  "durationMilliseconds",
                  "exitCode",
                  "signal",
                  "degraded",
                  "beforeEvidence",
                  "afterEvidence",
                  "failure",
                  "integration"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "page": {
              "additionalProperties": false,
              "properties": {
                "nextCursor": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "nextCursor"
              ],
              "type": "object"
            }
          },
          "required": [
            "items",
            "page"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_settings_update_preview`

Validate public runtime-setting changes and issue a five-minute receipt bound to current settings.

- **Title:** Preview settings update
- **Family:** settings
- **Safety:** mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_settings_update_preview`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "updates": {
      "additionalProperties": false,
      "properties": {
        "automaticPortRanges": {
          "items": {
            "additionalProperties": false,
            "properties": {
              "end": {
                "maximum": 65535,
                "minimum": 1,
                "type": "integer"
              },
              "start": {
                "maximum": 65535,
                "minimum": 1,
                "type": "integer"
              }
            },
            "required": [
              "start",
              "end"
            ],
            "type": "object"
          },
          "type": "array"
        },
        "diagnosticLogFiles": {
          "maximum": 9007199254740991,
          "minimum": -9007199254740991,
          "type": "integer"
        },
        "diagnosticLogMaximumBytes": {
          "maximum": 9007199254740991,
          "minimum": -9007199254740991,
          "type": "integer"
        },
        "ephemeralAssignmentTtlMilliseconds": {
          "maximum": 9007199254740991,
          "minimum": -9007199254740991,
          "type": "integer"
        },
        "excludedPorts": {
          "items": {
            "maximum": 65535,
            "minimum": 1,
            "type": "integer"
          },
          "type": "array"
        },
        "gracefulShutdownMilliseconds": {
          "maximum": 9007199254740991,
          "minimum": -9007199254740991,
          "type": "integer"
        },
        "historyMaximumEvents": {
          "maximum": 9007199254740991,
          "minimum": -9007199254740991,
          "type": "integer"
        },
        "leaseTtlMilliseconds": {
          "maximum": 9007199254740991,
          "minimum": -9007199254740991,
          "type": "integer"
        }
      },
      "type": "object"
    }
  },
  "required": [
    "updates"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_settings_update_preview`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "action": {
              "const": "settings.update",
              "type": "string"
            },
            "expiresAt": {
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
              "type": "string"
            },
            "observed": {
              "additionalProperties": false,
              "properties": {
                "current": {
                  "additionalProperties": false,
                  "properties": {
                    "automaticPortRanges": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "end": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "start": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          }
                        },
                        "required": [
                          "start",
                          "end"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "diagnosticLogFiles": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "diagnosticLogMaximumBytes": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "ephemeralAssignmentTtlMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "excludedPorts": {
                      "items": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "type": "array"
                    },
                    "gracefulShutdownMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "historyMaximumEvents": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "leaseTtlMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    }
                  },
                  "required": [
                    "automaticPortRanges",
                    "excludedPorts",
                    "leaseTtlMilliseconds",
                    "ephemeralAssignmentTtlMilliseconds",
                    "gracefulShutdownMilliseconds",
                    "historyMaximumEvents",
                    "diagnosticLogMaximumBytes",
                    "diagnosticLogFiles"
                  ],
                  "type": "object"
                }
              },
              "required": [
                "current"
              ],
              "type": "object"
            },
            "proposal": {
              "additionalProperties": false,
              "properties": {
                "proposed": {
                  "additionalProperties": false,
                  "properties": {
                    "automaticPortRanges": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "end": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "start": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          }
                        },
                        "required": [
                          "start",
                          "end"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "diagnosticLogFiles": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "diagnosticLogMaximumBytes": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "ephemeralAssignmentTtlMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "excludedPorts": {
                      "items": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "type": "array"
                    },
                    "gracefulShutdownMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "historyMaximumEvents": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "leaseTtlMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    }
                  },
                  "required": [
                    "automaticPortRanges",
                    "excludedPorts",
                    "leaseTtlMilliseconds",
                    "ephemeralAssignmentTtlMilliseconds",
                    "gracefulShutdownMilliseconds",
                    "historyMaximumEvents",
                    "diagnosticLogMaximumBytes",
                    "diagnosticLogFiles"
                  ],
                  "type": "object"
                },
                "updates": {
                  "additionalProperties": false,
                  "properties": {
                    "automaticPortRanges": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "end": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "start": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          }
                        },
                        "required": [
                          "start",
                          "end"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "diagnosticLogFiles": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "diagnosticLogMaximumBytes": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "ephemeralAssignmentTtlMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "excludedPorts": {
                      "items": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "type": "array"
                    },
                    "gracefulShutdownMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "historyMaximumEvents": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "leaseTtlMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    }
                  },
                  "type": "object"
                }
              },
              "required": [
                "updates",
                "proposed"
              ],
              "type": "object"
            },
            "receiptId": {
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
              "type": "string"
            },
            "target": {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "minLength": 1,
                  "type": "string"
                },
                "type": {
                  "const": "settings",
                  "type": "string"
                }
              },
              "required": [
                "type",
                "id"
              ],
              "type": "object"
            }
          },
          "required": [
            "receiptId",
            "action",
            "target",
            "proposal",
            "observed",
            "expiresAt"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_settings_update_execute`

Apply public runtime settings only while current settings still match the receipt.

- **Title:** Execute settings update
- **Family:** settings
- **Safety:** consequential-mutation
- **Receipt-bound:** yes
- **Bridge credential custody:** no
- **Annotations:** read-only no; destructive yes; idempotent yes; open-world no

#### Input schema for `portreeve_settings_update_execute`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "receiptId": {
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
      "type": "string"
    }
  },
  "required": [
    "receiptId"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_settings_update_execute`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "changed": {
              "type": "boolean"
            },
            "replayed": {
              "type": "boolean"
            },
            "result": {
              "additionalProperties": false,
              "properties": {
                "settings": {
                  "additionalProperties": false,
                  "properties": {
                    "automaticPortRanges": {
                      "items": {
                        "additionalProperties": false,
                        "properties": {
                          "end": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          },
                          "start": {
                            "maximum": 65535,
                            "minimum": 1,
                            "type": "integer"
                          }
                        },
                        "required": [
                          "start",
                          "end"
                        ],
                        "type": "object"
                      },
                      "type": "array"
                    },
                    "diagnosticLogFiles": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "diagnosticLogMaximumBytes": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "ephemeralAssignmentTtlMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "excludedPorts": {
                      "items": {
                        "maximum": 65535,
                        "minimum": 1,
                        "type": "integer"
                      },
                      "type": "array"
                    },
                    "gracefulShutdownMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "historyMaximumEvents": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    },
                    "leaseTtlMilliseconds": {
                      "maximum": 9007199254740991,
                      "minimum": -9007199254740991,
                      "type": "integer"
                    }
                  },
                  "required": [
                    "automaticPortRanges",
                    "excludedPorts",
                    "leaseTtlMilliseconds",
                    "ephemeralAssignmentTtlMilliseconds",
                    "gracefulShutdownMilliseconds",
                    "historyMaximumEvents",
                    "diagnosticLogMaximumBytes",
                    "diagnosticLogFiles"
                  ],
                  "type": "object"
                }
              },
              "required": [
                "settings"
              ],
              "type": "object"
            }
          },
          "required": [
            "changed",
            "replayed",
            "result"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```

### MCP tool: `portreeve_history_list`

Read bounded structured history with explicit filters.

- **Title:** List history
- **Family:** observability
- **Safety:** read-only
- **Receipt-bound:** no
- **Bridge credential custody:** no
- **Annotations:** read-only yes; destructive no; idempotent yes; open-world no

#### Input schema for `portreeve_history_list`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "afterCursor": {
      "minLength": 1,
      "type": "string"
    },
    "entityId": {
      "type": "string"
    },
    "entityType": {
      "type": "string"
    },
    "eventType": {
      "type": "string"
    },
    "limit": {
      "default": 50,
      "maximum": 200,
      "minimum": 1,
      "type": "integer"
    },
    "since": {
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
      "type": "string"
    }
  },
  "required": [
    "limit"
  ],
  "type": "object"
}
```

#### Structured output schema for `portreeve_history_list`

Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "additionalProperties": false,
      "properties": {
        "data": {
          "additionalProperties": false,
          "properties": {
            "items": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "entityId": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "entityType": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "eventType": {
                    "minLength": 1,
                    "type": "string"
                  },
                  "id": {
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                    "type": "string"
                  },
                  "occurredAt": {
                    "format": "date-time",
                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
                    "type": "string"
                  },
                  "origin": {
                    "anyOf": [
                      {
                        "additionalProperties": false,
                        "properties": {
                          "kind": {
                            "enum": [
                              "library",
                              "cli",
                              "desktop",
                              "mcp"
                            ],
                            "type": "string"
                          },
                          "label": {
                            "maxLength": 128,
                            "minLength": 1,
                            "type": "string"
                          },
                          "runId": {
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
                            "type": "string"
                          }
                        },
                        "required": [
                          "kind"
                        ],
                        "type": "object"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "payload": {
                    "additionalProperties": {},
                    "propertyNames": {
                      "type": "string"
                    },
                    "type": "object"
                  }
                },
                "required": [
                  "id",
                  "eventType",
                  "entityType",
                  "entityId",
                  "payload",
                  "origin",
                  "occurredAt"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "page": {
              "additionalProperties": false,
              "properties": {
                "nextCursor": {
                  "anyOf": [
                    {
                      "minLength": 1,
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "nextCursor"
              ],
              "type": "object"
            }
          },
          "required": [
            "items",
            "page"
          ],
          "type": "object"
        },
        "ok": {
          "const": true,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "data"
      ],
      "type": "object"
    },
    {
      "additionalProperties": false,
      "properties": {
        "error": {
          "additionalProperties": false,
          "properties": {
            "code": {
              "type": "string"
            },
            "details": {
              "additionalProperties": {},
              "propertyNames": {
                "type": "string"
              },
              "type": "object"
            },
            "message": {
              "type": "string"
            },
            "retryable": {
              "type": "boolean"
            }
          },
          "required": [
            "code",
            "message",
            "retryable",
            "details"
          ],
          "type": "object"
        },
        "ok": {
          "const": false,
          "type": "boolean"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "type": "object"
    }
  ],
  "type": "object"
}
```
<!-- PORTREEVE:GENERATED MCP-TOOLS END -->
