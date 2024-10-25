import { config } from "./config";
import { logger } from "./logger";
import { createServer } from "./server";

const server = await createServer();

server.listen(config.server.port, config.server.host, () => {
    logger.info(`Server started on port ${config.server.host}:${config.server.port}`);
});
