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

    this.router.patch('/room/members', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.addNewMember({ roomKey: req.body.roomKey, name: req.body.name, payments: req.body.payments })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.delete('/room/:roomKey/members/:memberId', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.deleteMember({ roomKey: req.params.roomKey, memberId: req.params.memberId })
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

    this.router.post('/register', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.addNewUser(
        { firstName: req.body.firstName, lastName: req.body.lastName, email: req.body.email, password: req.body.password }
      )
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.patch('/login', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.loginWithUser(
        { email: req.body.email, password: req.body.password }
      )
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.get('/user/rooms/:email', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.getUsersRooms(
        { email: req.params.email }
      )
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.get('/user/debts/:email', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.getUsersDebts(
        { email: req.params.email }
      )
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    // ############ QUIZLET ROUTES #################
    this.router.post('/quizlet', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.loginWithUserQuizlet({userName: req.body.userName})
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.post('/quizlet/new', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.createNewSet({userId: req.body.userId, title: req.body.title, cards: req.body.cards})
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.patch('/quizlet', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.editSet({ setId: req.body.setId, cards: req.body.cards })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    // ############ QUIZLET ROUTES #################
    this.router.post('/teo/challenge', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.addNewCompletedChallenge({ challengeId: req.body.challengeId })
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.get('/teo/challenge', (req: Request, res: Response) => {
      const controller = new Controller();
      controller.getCompletedChallenges()
      .then(result => { res.status(result.statusCode).send(result); })
      .catch(error => { res.status(error.statusCode || 500).send(error); });
    });

    this.router.use((req: Request, res: Response) => {
      res.send(new RoutingError('Route not found'));
    });
  }
}
