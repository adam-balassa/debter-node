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
      this.controller.createNewRoom({ roomKey: req.body.roomKey, roomName: req.body.roomName })
        .then(result => { res.send(result); })
        .catch(error => { res.send(error); });
    });

    this.router.post('/room/members', (req: Request, res: Response) => {
      this.controller.addMembersToRoom({ roomKey: req.body.roomKey, memberNames: req.body.members })
        .then(result => { res.send(result); })
        .catch(error => { res.send(error); });
    });

    this.router.patch('/room/login', (req: Request, res: Response) => {
      this.controller.loginRoom({ roomKey: req.body.roomKey })
        .then(result => { res.send(result); })
        .catch(error => { res.send(error); });
    });

    this.router.get('/room/:roomKey', (req: Request, res: Response) => {
      this.controller.loadEntireRoomData({ roomKey: req.params.roomKey })
        .then(result => { res.send(result); })
        .catch(error => { res.send(error); });
    });

    this.router.delete('/payment', (req: Request, res: Response) => {
      this.controller.deletePayment({ paymentId: req.body.paymentId, roomKey: req.body.roomKey })
        .then(result => { res.send(result); })
        .catch(error => { res.send(error); });
    });
  }
}
