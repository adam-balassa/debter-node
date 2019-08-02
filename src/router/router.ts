import { Router, Request, Response } from 'express';
import { Controller } from '../controller/controller';
export class Routes {
    router: Router;
    controller: Controller;
    public constructor(router: Router) {
        this.router = router;
        this.controller = new Controller();
        this.addRoutes();
    }

    private addRoutes() {
        this.router.get('/', (req: Request, res: Response) => {
            res.send('Hello world!');
        });

        this.router.post('/room', (req: Request, res: Response) => {
            this.controller.createNewRoom({roomKey: req.body.roomKey, roomName: req.body.roomName})
            .then( result => { res.send(result); } )
            .catch( error => { res.send(error); } );
        });
    }
}
