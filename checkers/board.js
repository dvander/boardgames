// vim: set ts=4 sw=4 tw=99 et:
// Copyright (C) 2010 David Anderson 
// dvander@alliedmods.net
// 
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
// 
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

var Checkers = {
    EmptyPlayer: 0,
    PlayerOne:   2,
    PlayerTwo:   3,

    MoveList: function (size) {
        this.list = new Array(size);
        this.length = 0;

        this.add = function (fromRow, fromCol, toRow, toCol) {
            var b = (fromRow << 24) |
                    (fromCol << 16) |
                    (toRow << 8) |
                    (toCol);
            this.list[this.length++] = b;
        }

        this.clear = function () {
            this.length = 0;
        }
    },

    Game: function (ui) {
        var EmptyPlayer = 0;
        var PlayerOne = 2;
        var PlayerTwo = 3;
        var rows = ui.rows;
        var cols = ui.cols;
        var RowsPerPlayer = (rows - 2) >> 1;
        var BoardArea = rows * cols;
        var PiecesPerPlayer = RowsPerPlayer * (cols / 2);

        var Board = function () {
            this.rows = rows;
            this.cols = cols;
            this.pieceCount = [0, 0, PiecesPerPlayer, PiecesPerPlayer];

            // The BoardArea part of the grid stores:
            //   bit  0-1: Player ID
            //   bit    2: 0 if normal, 1 if king
            //   bit 8-16: key
            // 
            // After BoardArea comes a list of each player's pieces,
            // PlayerOne followed by PlayerTwo. The list is sparse,
            // and indexed directly by key, from above. Each value is
            // -1 for "removed", or:
            //   bit  0-7: row
            //   bit 8-16: column
            this.grid = new Array(BoardArea + (PiecesPerPlayer * 2));
        }

        Board.prototype.initPiece = function (row, col, key, player) {
            this.grid[row * this.cols + col] = (key << 8) | player;
            this.grid[BoardArea + key] = (row << 8) | col;
        }

        Board.prototype.removePiece = function (row, col) {
            var pos = row * this.cols + col;
            var piece = this.grid[pos];
            this.grid[pos] = 0;

            var key = (piece >> 8) & 0xFF;
            var player = piece & 0x3;
            this.grid[BoardArea + key] = -1;

            // If removing a king, decrement the king count.
            if (piece & 4)
                this.pieceCount[player & 1]--;

            return --this.pieceCount[player];
        }

        Board.prototype.getPiece = function (row, col) {
            return this.grid[(row << 3) + col];
            //return this.grid[row * this.cols + col];
        }

        Board.prototype.getPlayer = function (row, col) {
            return this.getPiece(row, col) & 3;
        }

        Board.prototype.clear = function () {
            this.player = PlayerOne;
            this.multiTurn = false;
            for (var i = 0; i < BoardArea; i++)
                this.grid[i] = 0;
        }

        Board.prototype.coordToIndex = function (row, col) {
            return (row << 3) + col;
            //return row * this.cols + col;
        }

        Board.prototype.opponent = function () {
            return this.player ^ 1;
        }

        Board.prototype.area = function () {
            return BoardArea;
        }

        Board.prototype.validateMove = function (fromRow, fromCol, toRow, toCol) {
            // Source piece must be the current player.
            if (this.getPlayer(fromRow, fromCol) != this.player)
                throw "piece is not yours";

            // Destination cannot have a filled square.
            if (this.getPiece(toRow, toCol))
                throw "square is not empty";

            // Movement must be diagonal.
            var rowDelta = Math.abs(fromRow - toRow);
            var colDelta = Math.abs(fromCol - toCol);
            if (rowDelta != colDelta)
                throw "moves must be diagonal";

            // Non-kings cannot move backwards.
            if (!(this.getPiece(fromRow, fromCol) & 4)) {
                if (this.player == PlayerTwo && toRow > fromRow)
                    throw "this piece must move forward";
                else if (this.player == PlayerOne && toRow < fromRow)
                    throw "this piece must move forward";
            }

            if (rowDelta > 1) {
                if (rowDelta > 2)
                    throw "you cannot move more than 2 spaces";
                if (!this.isValidJump(fromRow, fromCol, toRow, toCol))
                    throw "you can only move 2 spaces by jumping another piece";
                return true;
            }

            // A multi-turn must have ended in a jump.
            if (this.multiTurn)
                throw "if a jump is possible, you must jump";

            // Detect if any jumps are possible.
            for (var row = 0; row < this.rows; row++) {
                for (var col = 0; col < this.cols; col++) {
                    if (this.getPlayer(row, col) != this.player)
                        continue;
                    var isKing = this.isKing(row, col);
                    if (this.canCapture(isKing, row, col))
                        throw "if a jump is possible, you must jump";
                }
            }
        }

        // Move lists are vectors where each entry is a move, encoded as a
        // bitstring for efficiency.
        Board.prototype.fillMoveList = function (moveList) {
            var start = BoardArea + (this.player & 1) * PiecesPerPlayer;
            var canCapture = false;
            for (var i = 0; i < PiecesPerPlayer; i++) {
                var piece = this.grid[start + i];
                if (piece == -1)
                    continue;

                var fromRow = piece >> 8;
                var fromCol = piece & 0xFF;
                var isKing = this.grid[this.coordToIndex(fromRow, fromCol)] & 4;
                var opponent = this.player ^ 1;

                // Test movement from row 0 -> E.
                if ((isKing || this.player == 2) && fromRow != this.rows - 1) {
                    var left = 0, right = 0;
                    if (fromCol != 0) {
                        left = this.getPiece(fromRow + 1, fromCol - 1);
                        if (!left && !canCapture)
                            moveList.add(fromRow, fromCol, fromRow + 1, fromCol - 1);
                    }
                    if (fromCol != this.cols - 1) {
                        right = this.getPiece(fromRow + 1, fromCol + 1);
                        if (!right && !canCapture)
                            moveList.add(fromRow, fromCol, fromRow + 1, fromCol + 1);
                    }

                    // Test if we can add any jumps.
                    if (fromRow != this.rows - 2) {
                        if ((left & 3) == opponent &&
                            fromCol >= 2 &&
                            !this.getPiece(fromRow + 2, fromCol - 2)) {
                            if (!canCapture) {
                                moveList.clear();
                                canCapture = true;
                            }
                            moveList.add(fromRow, fromCol, fromRow + 2, fromCol - 2);
                        }
                        if ((right & 3) == opponent &&
                            fromCol < this.cols - 2 &&
                            !this.getPiece(fromRow + 2, fromCol + 2)) {
                            if (!canCapture) {
                                moveList.clear();
                                canCapture = true;
                            }
                            moveList.add(fromRow, fromCol, fromRow + 2, fromCol + 2);
                        }
                    }
                }

                // Test movement from row E -> 0.
                if ((isKing || this.player == 3) && fromRow != 0) {
                    var left = 0, right = 0;
                    if (fromCol != 0) {
                        left = this.getPiece(fromRow - 1, fromCol - 1);
                        if (!left && !canCapture)
                            moveList.add(fromRow, fromCol, fromRow - 1, fromCol - 1);
                    }
                    if (fromCol != this.cols - 1) {
                        right = this.getPiece(fromRow - 1, fromCol + 1);
                        if (!right && !canCapture)
                            moveList.add(fromRow, fromCol, fromRow - 1, fromCol + 1);
                    }

                    // Test if we can add any jumps.
                    if (fromRow >= 2) {
                        if ((left & 3) == opponent &&
                            fromCol >= 2 &&
                            !this.getPiece(fromRow - 2, fromCol - 2)) {
                            if (!canCapture) {
                                moveList.clear();
                                canCapture = true;
                            }
                            moveList.add(fromRow, fromCol, fromRow - 2, fromCol - 2);
                        }
                        if ((right & 3) == opponent &&
                            fromCol < this.cols - 2 &&
                            !this.getPiece(fromRow - 2, fromCol + 2)) {
                            if (!canCapture) {
                                moveList.clear();
                                canCapture = true;
                            }
                            moveList.add(fromRow, fromCol, fromRow - 2, fromCol + 2);
                        }
                    }
                }
            }
        }

        Board.prototype.isValidJump = function (fromRow, fromCol, toRow, toCol) {
            // The intervening empty square must have an enemy piece.
            var middleRow = (fromRow + toRow) >> 1;
            var middleCol = (fromCol + toCol) >> 1;
            var middlePiece = this.getPlayer(middleRow, middleCol);
            return middlePiece == (this.player ^ 1);
        }

        Board.prototype.isValidHop = function (fromRow, fromCol, toRow, toCol) {
            // Destination must be empty.
            if (this.getPiece(toRow, toCol))
                return false;
            return this.isValidJump(fromRow, fromCol, toRow, toCol);
        }

        Board.prototype.canCapture = function (isKing, row, col) {
            return (row >= 2 && col >= 2 &&
                    (isKing || this.player == 3) &&
                    this.isValidHop(row, col, row - 2, col - 2)) ||
                   (row >= 2 && col < this.cols - 2 &&
                    (isKing || this.player == 3) &&
                    this.isValidHop(row, col, row - 2, col + 2)) ||
                   (row < this.rows - 2 && col >= 2 &&
                    (isKing || this.player == 2) &&
                    this.isValidHop(row, col, row + 2, col - 2)) ||
                   (row < this.rows - 2 && col < this.cols - 2 &&
                    (isKing || this.player == 2) &&
                    this.isValidHop(row, col, row + 2, col + 2));
        }

        Board.prototype.isKing = function (row, col) {
            return this.getPiece(row, col) & 4;
        }

        Board.prototype.evaluateScore = function (player) {
            return (this.pieceCount[player & 1] * 5) +
                   (this.pieceCount[player]);
        }

        // This function is called in the tightest loop inside UCT, and is
        // thus EXTREMELY hot.
        Board.prototype.move = function (fromRow, fromCol, toRow, toCol) {
            var fromIndex = this.coordToIndex(fromRow, fromCol);
            var piece = this.grid[fromIndex];
            this.grid[fromIndex] = 0;

            if ((this.player == 2 && toRow == this.rows - 1) ||
                (this.player == 3 && toRow == 0)) {
                // King me!
                piece |= 4;
                this.pieceCount[this.player & 1]++;
            }

            // Update board.
            var toIndex = this.coordToIndex(toRow, toCol);
            this.grid[toIndex] = piece;

            // Update tracking.
            var key = (piece >> 8) & 0xFF;
            this.grid[BoardArea + key] = (toRow << 8) | toCol;

            // Trick: 1 and -1 have bit 1 set, 2 and -2 do not.
            if (!((fromRow - toRow) & 1)) {
                // We assume that move validity was checked already, and that
                // if this piece has an even delta, it is jumping something.
                var middleRow = (fromRow + toRow) >> 1;
                var middleCol = (fromCol + toCol) >> 1;
                if (!this.removePiece(middleRow, middleCol))
                    return true;

                // A successful jump means the player gets to jump again.
                // Detect that by seeing if any two-space hops are legal.
                var multiTurn = this.canCapture(piece & 4, toRow, toCol);
                this.multiTurn = multiTurn;
                if (multiTurn)
                    return false;
            }

            // Switch to the next player.
            this.player ^= 1;

            return false;
        }

        Board.prototype.copy = function () {
            var board = new Board();
            var gridSize = this.grid.length;
            var to = board.grid;
            var from = this.grid;
            for (var i = 0; i < gridSize; i++)
                to[i] = from[i];
            board.player = this.player;
            board.multiTurn = this.multiTurn;
            board.pieceCount[0] = this.pieceCount[0];
            board.pieceCount[1] = this.pieceCount[1];
            board.pieceCount[2] = this.pieceCount[2];
            board.pieceCount[3] = this.pieceCount[3];
            return board;
        }

        // If no moves are available, returns that the opponent won.
        // If the move is a winning move, return the current player.
        // Otherwise, return 0.
        Board.prototype.moveRandom = function (moves) {
            moves.clear();
            this.fillMoveList(moves);
            if (!moves.length)
                return this.opponent();
            var r = Math.floor(Math.random() * moves.length);
            var move = moves.list[r];
            var fromRow = move >> 24;
            var fromCol = (move >> 16) & 0xFF;
            var toRow = (move >> 8) & 0xFF;
            var toCol = (move) & 0xFF;
            if (this.move(fromRow, fromCol, toRow, toCol))
                return this.player;
            return 0;
        }

        Board.prototype.init = function () {
            this.clear();

            // First fill in player one.
            var odds = 1;
            var key = 0;
            for (var i = 0; i < RowsPerPlayer; i++) {
                for (var j = odds; j < this.cols; j += 2) {
                    this.initPiece(i, j, key, PlayerOne);
                    key++;
                }
                odds ^= 1;
            }

            // Fill in player two.
            odds = 0;
            for (var i = RowsPerPlayer + 2; i < this.rows; i++) {
                for (var j = odds; j < this.cols; j += 2) {
                    this.initPiece(i, j, key, PlayerTwo);
                    key++;
                }
                odds ^= 1;
            }
        }

        this.player = function () {
            return this.board.player;
        };
        this.playerAt = function (row, col) {
            return this.board.getPlayer(row, col);
        }
        this.inMultiTurn = function () {
            return this.board.multiTurn;
        };

        this.move = function (fromRow, fromCol, toRow, toCol) {
            this.board.validateMove(fromRow, fromCol, toRow, toCol);
            if (this.board.move(fromRow, fromCol, toRow, toCol))
                return this.board.player;
            var moves = new Checkers.MoveList(BoardArea);
            this.board.fillMoveList(moves);
            if (!moves.length)
                return this.board.opponent();
            return 0;
        };

        this.suggest = function (maxTime) {
            return UCT(this.board, maxTime);
        }

        this.board = new Board();
        this.board.init();

        this.start = function () {
            ui.start(this);
        }
    }
};

