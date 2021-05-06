# Pi Relay Controller Server
This is the server application for the [Homey](https://homey.app/en-us/) app [Pi Relay Controller Homey](https://github.com/daviwil2/pi-relay-controller-homey) that runs on Raspberry Pi with the SB Components relay shield.

Configuration is via the ```config.yaml``` file where defaults and GPIO mappings can be edited should another relay board be used.

The [@grpc/grpc-js](https://www.npmjs.com/package/@grpc/grpc-js) and [@grpc/proto-loader](https://www.npmjs.com/package/@grpc/proto-loader) libraries are used to implement gRPC functionality.

This application was developed and tested on a Raspberry Pi 4 running Raspbian 32-bit and node.js v16 with SB Components relay shield; other SBCs and Linux distributions such as Ubuntu may work but they have not been tested.

## License
Copyright (C) 2019-2021 by David Williamson.

The source code is completely free and released under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.
