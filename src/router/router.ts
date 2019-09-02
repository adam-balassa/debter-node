import { Router, Request, Response } from 'express';
import { Controller } from '../controller/controller';
import { RoutingError } from '../interfaces/exceptions.model';
export class Routes {
  router: Router;
  public constructor(router: Router) {
    this.router = router;
    this.addRoutes();
  }

  private addRoutes() {
    this.router.get('/', (req: Request, res: Response) => {
      res.send('Hello world!');
    });

    this.router.post('/room', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.createNewRoom({ roomName: req.body.roomName })
        .then(result => { res.status(result.statusCode).send(result); })
        .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.delete('/rooms', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.deleteUnusedRooms()
        .then(result => { res.status(result.statusCode).send(result); })
        .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.post('/room/members', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.addMembersToRoom({ roomKey: req.body.roomKey, members: req.body.members })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.patch('/room/login', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.loginRoom({ roomKey: req.body.roomKey })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.get('/room/:roomKey', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.loadEntireRoomData({ roomKey: req.params.roomKey })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.post('/payment', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.uploadPayment({
        roomKey: req.body.roomKey,
        value: req.body.value,
        currency: req.body.currency,
        memberId: req.body.memberId,
        included: req.body.included,
        note: req.body.note
      })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.delete('/room/:roomKey/payment/:paymentId', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.deletePayment({ paymentId: req.params.paymentId, roomKey: req.params.roomKey })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.patch('/room/:roomKey/payment/:paymentId', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.revivePayment({ paymentId: req.params.paymentId, roomKey: req.params.roomKey })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.patch('/settings/currency', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.setCurrency({ roomKey: req.body.roomKey, mainCurrency: req.body.mainCurrency })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.patch('/settings/rounding', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.setRounding({ roomKey: req.body.roomKey, rounding: req.body.rounding })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.get('/refresh', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.refreshAllDebts()
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.use((req: Request, res: Response) => {
      res.send(new RoutingError('Route not found'));
    });
  }
}
