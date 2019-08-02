import { Success, Response, ServerError, ParameterNotProvided } from '../interfaces/exceptions.model';
import { DataLayer } from '../database/datalayer';
import { DRoom, DDetail } from '../interfaces/database.model';

export class Controller {

    dataLayer: DataLayer;

    public constructor() {
        this.dataLayer = new DataLayer();
    }

    public createNewRoom(data: { roomKey: string, roomName: string }): Promise<Response> {
        let param;
        if ((param = this.check(data, 'roomKey', 'roomName')) !== null)
            return Promise.reject(new ParameterNotProvided(param));
        if ( data.roomKey.length !== 6 )
            return Promise.reject(new ServerError('roomKey must be 6 letters long'));
        const room: DRoom = {
            id: this.generateId(),
            room_key: data.roomKey
        };
        const details: DDetail = {
            room_id: room.id,
            name: data.roomName,
            rounding: 1,
            default_currency: 'HUF',
            last_modified: new Date()
        };
        return this.dataLayer.createNewRoom(room, details);
    }

    private check(object: {[key: string]: any}, ...keys: string[]): string | null {
        for (const key of keys)
            if (object[key] === undefined || object[key] === null) return key;
        return null;
    }

    private generateId() {
        return 'xxxxx4xxx-yxxxxxxxxx'.replace(/[xy]/g, function(c) {
            // tslint:disable-next-line: no-bitwise
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
