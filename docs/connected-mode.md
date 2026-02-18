# Connected Mode

Connected mode delegates certain skill execution to a client (useful for client-native task calls).

## Enable

```ts
npcPlugin({
  adapter: 'fivem',
  connected: true,
})
```

Also install the client plugin:

```ts
Client.init({ plugins: [npcClient()] })
```

## Transport Strategy

- Primary path: net wire (`emitNet/onNet`).
- Secondary fallback: RPC caller when available.

This strategy is automatic when connected mode is on.

## Debug Logs

Enable transport debug with convar:

```cfg
setr OPENCORE_NPC_TRANSPORT_DEBUG 1
```

Expected log families:

- `DELEGATE_SEND`, `DELEGATE_OK`, `DELEGATE_FAIL`
- `WIRE_SEND`, `WIRE_RESULT`, `WIRE_TIMEOUT`, `WIRE_FAILOVER`

## Common Runtime Issues

- `no_executor`: no ready client executor available.
- `missing_npc_netid`: NPC network id unavailable.
- `...timeout`: request sent but no result received before timeout.

If delegation works but wait conditions timeout, check your observation data and destination consistency.
