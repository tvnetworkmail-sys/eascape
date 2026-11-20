import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import EventMouseClick from '#/network/game/client/model/EventMouseClick.js';

export default class EventMouseClickHandler extends ClientGameMessageHandler<EventMouseClick> {
    handle(message: EventMouseClick, player: Player): boolean {
        player.input.mouseClick(message);
        player.botWatch.click(message.info); // EASCape: in-game bot detection
        return true;
    }
}
