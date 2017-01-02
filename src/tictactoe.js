const AssistantFeature = require('virtual-assistant').AssistantFeature,
    StateMachine = require('javascript-state-machine'),
    _ = require('lodash');


class TicTacToe extends AssistantFeature {

    static getTriggerKeywords() {
        return [
            'morpion', 'tic tac toe', 'tictactoe', 'tic-tac-toe'
        ];
    }

    static getDescription() {
        return 'Jouer au morpion';
    }

    static getTTL() {
        return 5 /* min */ * 60;
    }


    constructor(interfac, context, id) {
        super(interfac, context, id);
        StateMachine.create({
            target: TicTacToe.prototype,
            initial: { state: 'InitGame', event: 'startup', defer: true }, // defer is important since the startup event is launched after the fsm is stored in cache
            terminal: 'End',
            events: [
                { name: 'startup', from: 'none',   to: 'InitGame' },

                { name: 'playerTurn', from: 'InitGame', to: 'PlayerTurn' },
                { name: 'playerTurn', from: 'CheckAfterTurn', to: 'PlayerTurn' },

                { name: 'aiTurn', from: 'InitGame', to: 'AiTurn' },
                { name: 'aiTurn', from: 'CheckAfterTurn', to: 'AiTurn' },

                { name: 'internal', from: 'AiTurn', to: 'CheckAfterTurn' },
                { name: 'text', from: 'PlayerTurn', to: 'CheckAfterTurn' },

                { name: 'end', from: '*', to: 'End' },
            ]
        });


        // context is : 
        // { 
        //  userId: xxx, 
        //  channelId: xxx,
        //  model: {
        //    currentPlayer: -1|1
        //    game: [[],[],[]]
        //  }
        // }
        this.context.model = {};
    }

    handle(message, context) {
        super.handle(message, context);
        if(this.current === 'none') {
            this.startup();
        }
        else {
            if(message.match(/(?:fin|end|exit|stop|quit|quitter|bye)/i) && this.canTriggerEvent('end')) {
                this.end(context.userId);
            }
            else if(this.canTriggerEvent('text')) {
                this.text(message, context.userId);
            }
        }
    }



    /******** HELPERS ************/

    initFirstPlayer() {
        this.context.model.currentPlayer = _.random();
        if(this.context.model.currentPlayer === 0) {
            // Values are -1 or 1
            this.context.model.currentPlayer = -1;
        }
        this.context.model.currentPlayer = 1
    }

    getRowCount() {
        return 3;
    }

    initBoard() {
        var rowCount = this.getRowCount(),
            row = _.fill(Array(rowCount), 0);
        this.context.model.game = [];
        for(var i = 0; i < rowCount; i++) {
            this.context.model.game.push(_.clone(row));
        }
    }

    getPlayerEventName() {
        switch(this.context.model.currentPlayer) {
            case 1:
                return 'playerTurn';
            case -1:
                return 'aiTurn';
            default:
                console.error('Error: player ', this.context.model.currentPlayer, 'does not exists. Values -1 or 1 are expected.');
                break;
        }
    }

    togglePlayers() {
        this.context.model.currentPlayer = -this.context.model.currentPlayer;
    }

    nextTurn() {
        this[this.getPlayerEventName()]();
    }

    play(row, col) {
        this.context.model.game[row][col] = this.context.model.currentPlayer;
    }

    canGameContinue() {
        for(var i = 0; i < this.context.model.game.length; i++) {
            var row = this.context.model.game[i];
            for(var j = 0; j < row.length; j++) {
                var e = row[j];
                if(e === 0) {
                    return true;
                }
            }
        }
        return false;
    }

    getWinner() {
        // Check rows
        for(var i = 0; i < this.getRowCount(); i++) {
            var first = this.context.model.game[i][0];
            // Si on a un 0 sur la premier case, la ligne est forcément incomplète
            if(first !== 0) {
                var differents = false;
                for(var j = 0; j < this.getRowCount() && !differents; j++) {
                    if(first !== this.context.model.game[i][j]) {
                        differents = true;
                    }
                }
                if(!differents) {
                    // Si toutes les cases de la ligne ne sont pas différents, on a une ligne complete
                    return first;
                }
            }
        }

        // Check cols
        for(var i = 0; i < this.getRowCount(); i++) {
            var first = this.context.model.game[0][i];
            // Si on a un 0 sur la premier case, la ligne est forcément incomplète
            if(first !== 0) {
                var differents = false;
                for(var j = 0; j < this.getRowCount() && !differents; j++) {
                    if(first !== this.context.model.game[j][i]) {
                        differents = true;
                    }
                }
                if(!differents) {
                    // Si toutes les cases de la ligne ne sont pas différents, on a une ligne complete
                    return first;
                }
            }
        }

        // Check diag 1
        var first = this.context.model.game[0][0];
        if(first !== 0) {
            var differents = false;
            for(var i = 0; i < this.getRowCount() && !differents; i++) {
                if(first !== this.context.model.game[i][i]) {
                    differents = true;
                }
            }
            if(!differents) {
                return first;
            }
        }

        // Check diag 2
        var first = this.context.model.game[0][(this.getRowCount() - 1)];
        if(first !== 0) {
            var differents = false;
            for(var i = 0; i < 3 && !differents; i++) {
                if(first !== this.context.model.game[i][(this.getRowCount() - 1) - i]) {
                    differents = true;
                }
            }
            if(!differents) {
                return first;
            }
        }
    }

    isLocationEmpty(row, col) {
        return !this.context.model.game[row][col];
    }

    displayGame() {
        var toSend = ['Le jeu :', '```'],
            that = this;
        _.forEach(this.context.model.game, function(row, i) {
            if(i > 0) {
                var line = '';
                for(var i = 0; i < that.getRowCount(); i++) {
                    line += '----';
                }
                toSend.push(line);
            }
            var displayRow = '';
            _.forEach(row, function(e, j) {
                if(j > 0) {
                    displayRow += '|';
                }
                switch(e) {
                    case 0:
                        displayRow += '   ';
                        break;
                    case 1:
                        displayRow += ' X ';
                        break;
                    case -1:
                        displayRow += ' O ';
                        break;
                }
            });
            toSend.push(displayRow);
        });
        toSend.push('```');
        this.send(toSend);        
    }

    getAIMove() {
        var move = {
                row: 0,
                col: 0
            },
            game = this.context.model.game;
        console.log(game);
        // https://en.wikipedia.org/wiki/Tic-tac-toe#Strategy

        // 1 > win
        console.log(1)
        var diag1Count = 0,
            diag2Count = 0;
        for(var i = 0; i < this.getRowCount(); i++) {
            var rowCount = 0,
                colCount = 0;
            for(var j = 0; j < this.getRowCount(); j++) {
                rowCount += game[i][j];
                colCount += game[j][i];
            }
            diag1Count += game[i][i];
            diag2Count += game[i][this.getRowCount() - 1 - i];
            if(rowCount === -(this.getRowCount() - 1)) {
                // two -1 and no 1 on the row, will win
                move.row = i;
                _.forEach(game[i], function(e, j) {
                    if(e === 0) {
                        move.col = j;
                    }
                });
                console.log(1, 1)
                return move;
            }
            if(colCount === -(this.getRowCount() - 1)) {
                // two -1 and no 1 on the col, will win
                _.forEach(game, function(e, j) {
                    if(e[i] === 0) {
                        move.row = j;
                    }
                });
                move.col = i;
                console.log(1, 2)
                return move;
            }
        }
        if(diag1Count === -(this.getRowCount() - 1)) {
            console.log(1, 3)
            for(var i = 0; i < this.getRowCount(); i++) {
                if(game[i][i] === 0) {
                    move.row = i;
                    move.col = i;
                    return move;
                }
            }
        }
        if(diag2Count === -(this.getRowCount() - 1)) {
            console.log(1, 4)
            for(var i = 0; i < this.getRowCount(); i++) {
                if(game[i][this.getRowCount() - 1 - i] === 0) {
                    move.row = i;
                    move.col = this.getRowCount() - 1 - i;
                    return move;
                }
            }
        }

        // 2 > block
        console.log('2')
        var diag1Count = 0,
            diag2Count = 0;
        for(var i = 0; i < this.getRowCount(); i++) {
            var rowCount = 0,
                colCount = 0;
            for(var j = 0; j < this.getRowCount(); j++) {
                rowCount += game[i][j];
                colCount += game[j][i];
            }
            diag1Count += game[i][i];
            diag2Count += game[i][this.getRowCount() - 1 - i];
            if(rowCount === (this.getRowCount() - 1)) {
                // two 1 and no -1 on the row, will loose, block
                move.row = i;
                _.forEach(game[i], function(e, j) {
                    if(e === 0) {
                        move.col = j;
                    }
                });
                console.log(2, 1)
                return move;
            }
            if(colCount === (this.getRowCount() - 1)) {
                // two 1 and no -1 on the col, will loose, block
                _.forEach(game, function(e, j) {
                    if(e[i] === 0) {
                        move.row = j;
                    }
                });
                move.col = i;
                console.log(2, 2)
                return move;
            }
        }
        if(diag1Count === (this.getRowCount() - 1)) {
            console.log(2, 3)
            for(var i = 0; i < this.getRowCount(); i++) {
                if(game[i][i] === 0) {
                    move.row = i;
                    move.col = i;
                    return move;
                }
            }
        }
        if(diag2Count === (this.getRowCount() - 1)) {
            console.log(2, 4)
            for(var i = 0; i < this.getRowCount(); i++) {
                if(game[i][this.getRowCount() - 1 - i] === 0) {
                    move.row = i;
                    move.col = this.getRowCount() - 1 - i;
                    return move;
                }
            }
        }

        // 3 > fork

        // 4 > block opponent's fork

        // 5 > center
        console.log('5')
        if(this.isLocationEmpty(_.floor(this.getRowCount() / 2), _.floor(this.getRowCount() / 2))) {
            console.log('5 ok')
            move.row = _.floor(this.getRowCount() / 2);
            move.col = _.floor(this.getRowCount() / 2);
            return move;
        }

        // 6 > opposite corner
        console.log('6')
        if(game[0][0] === 1 && this.isLocationEmpty(this.getRowCount() - 1, this.getRowCount() - 1)) {
            console.log('6', 1)
            move.row = this.getRowCount() - 1;
            move.col = this.getRowCount() - 1;
            return move;
        }
        if(game[this.getRowCount() - 1][this.getRowCount() - 1] === 1 && this.isLocationEmpty(0, 0)) {
            console.log('6', 2)
            move.row = 0;
            move.col = 0;
            return move;
        }
        if(game[0][this.getRowCount() - 1] === 1 && this.isLocationEmpty(this.getRowCount() - 1, 0)) {
            console.log('6', 3)
            move.row = this.getRowCount() - 1;
            move.col = 0;
            return move;
        }
        if(game[this.getRowCount() - 1][0] === 1 && this.isLocationEmpty(0, this.getRowCount() - 1)) {
            console.log('6', 4)
            move.row = 0;
            move.col = this.getRowCount() - 1;
            return move;
        }

        // 7 > empty corner
        console.log('7')
        if(this.isLocationEmpty(this.getRowCount() - 1, this.getRowCount() - 1)) {
            console.log('7', 1)
            move.row = this.getRowCount() - 1;
            move.col = this.getRowCount() - 1;
            return move;
        }
        if(this.isLocationEmpty(0, 0)) {
            console.log('7', 2)
            move.row = 0;
            move.col = 0;
            return move;
        }
        if(this.isLocationEmpty(this.getRowCount() - 1, 0)) {
            console.log('7', 3)
            move.row = this.getRowCount() - 1;
            move.col = 0;
            return move;
        }
        if(this.isLocationEmpty(0, this.getRowCount() - 1)) {
            console.log('7', 4)
            move.row = 0;
            move.col = this.getRowCount() - 1;
            return move;
        }

        // 8 > empty side
        for(var i = 0; i < this.getRowCount(); i++) {
            for(var j = 0; j < this.getRowCount(); j++) {
                if(this.isLocationEmpty(i, j)) {
                    move.row = i;
                    move.col = j;
                    return move;
                }
                if(this.isLocationEmpty(j, i)) {
                    move.row = j;
                    move.col = i;
                    return move;
                }
            }
        }


        return move;
    }



    /**********  STATES   *************/


    onInitGame(event, from, to) {
        this.send('Prenons un peu de bon temps ...');
        this.initBoard();
        this.initFirstPlayer();
        this.displayGame();
        this.nextTurn();
    }

    onCheckAfterTurn(event, from, to) {
        this.displayGame();
        var winner = this.getWinner();
        if(winner) {
            this.send([
                ((winner === 1) ? 'Vous gagnez': 'Je gagne') + ' la partie !'
            ]);
            this.end();
        }
        else if(!this.canGameContinue()) {
            this.send([
                'Pas de gagnant cette fois ci ...'
            ]);
            this.end();
        }
        else {
            this.togglePlayers();
            this.nextTurn();
        }
    }

    onPlayerTurn(event, from, to) {
        this.send('A vous de jouer ! (donnez le numéro de case entre 1 et ' + (this.getRowCount() * this.getRowCount()) + ')');
    }

    onleavePlayerTurn(event, from, to, text) {
        if(event === 'text') {
            if(_.isNaN(parseInt(text)) 
                || parseInt(text) > (this.getRowCount() * this.getRowCount())
                || parseInt(text) < 1) {
                this.send("Le numéro donné n'est pas valide. Merci de donner un chiffre entre 1 et " + (this.getRowCount() * this.getRowCount()));
                return false;
            }
            var value = parseInt(text),
                row = _.floor((value - 1) / this.getRowCount()),
                col = (value - 1) % this.getRowCount();

            if(!this.isLocationEmpty(row, col)) {
                this.send("Cette case contient a déjà été jouée");
                return false;
            }

            this.play(row, col);
        }
    }

    onAiTurn(event, from, to) {
        this.send('A mon tour !');
        var move = this.getAIMove();
        console.log('AI move ', move);
        this.context.model.game[move.row][move.col] = -1;
        this.internal();
    }

    onEnd(event, from, to) {
        this.send('Partie terminée !');
        this.endAndClearCache();
    }


}

module.exports = TicTacToe;
