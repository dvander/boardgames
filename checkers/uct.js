// vim: set ts=4 sw=4 tw=99 et:
// Copyright (C) 2010 David Anderson 
// dvander@alliedmods.net
//
// UCT Algorithm: Upper Confidence bounds applied to Trees
// Based on "Bandit based Monte-Carlo Planning" by
//   Levente Kocsis and Csaba Szepasvari
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

function UCTNode(move, player) {
    this.visits = 1;
    this.score = 0;
    this.children = null;
    this.player = player;
    this.move = move;
}

UCTNode.prototype.opponent = function () {
    return this.player ^ 1;
}

UCTNode.prototype.append = function (child) {
    if (!this.children)
        this.children = [child];
    else
        this.children.push(child);
}

UCTNode.prototype.playFor = function (board) {
    var move = this.move;
    var fromRow = move >> 24;
    var fromCol = (move >> 16) & 0xFF;
    var toRow = (move >> 8) & 0xFF;
    var toCol = (move) & 0xFF;
    return board.move(fromRow, fromCol, toRow, toCol);
}

UCTNode.prototype.expand = function (board, moveList) {
    moveList.clear();
    board.fillMoveList(moveList);

    for (var i = 0; i < moveList.length; i++) {
        var child = new UCTNode(moveList.list[i], board.player);
        this.append(child);
    }
}

UCTNode.prototype.ucb = function (coeff) {
    var score = (this.score / this.visits);
    return score + Math.sqrt(coeff / this.visits);
}

UCTNode.prototype.findBestChild = function () {
    var coeff = 20 * Math.log(this.visits);
    var bestScore = -Infinity;
    var bestChild = null;
    for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        var score = child.ucb(coeff);
        if (score > bestScore) {
            bestScore = score;
            bestChild = child;
        }
    }
    return bestChild;
}

function UCT(original, maxTime) {
    var root = new UCTNode(0, 0);
    var moveList = new Checkers.MoveList(original.area());
    var MaxHistory = original.area();
    var MaturityThreshold = 200;

    // Populate the first node.
    root.expand(original, moveList);
    var history = [root];

    function playout(board) {
        var nmoves = 0;

        while (++nmoves < 60) {
            var result = board.moveRandom(moveList);
            if (result)
                return result;
        }
        var p1 = board.evaluateScore(Checkers.PlayerOne);
        var p2 = board.evaluateScore(Checkers.PlayerTwo);
        if (p1 > p2)
            return Checkers.PlayerOne;
        if (p1 < p2)
            return Checkers.PlayerTwo;
        return 0;
    }

    function run() {
        var depth = 1;
        var board = original.copy();
        var node = root;
        var winner = 0;

        while (true) {
            if (node.children === null) {
                if (node.visits >= MaturityThreshold) {
                    node.expand(board, moveList);

                    // Leaf node - go directly to update.
                    if (node.children === null) {
                        winner = node.opponent();
                        history[depth++] = node;
                        break;
                    }
                    continue;
                }
                winner = playout(board);
                break;
            }
            node = node.findBestChild();
            history[depth++] = node;
            if (node.playFor(board)) {
                winner = board.player;
                break;
            }
        }

        for (var i = 0; i < depth; i++) {
            node = history[i];
            node.visits++;
            if (winner == node.player)
                node.score += 1;
            else if (winner != 0)
                node.score -= 1;
        }
    }

    var TotalPlayouts = 0;
    var start = Date.now();
    var elapsed;
    while (true) {
        for (var i = 0; i < 500; i++)
            run();
        TotalPlayouts += 500;
        elapsed = Date.now() - start;
        if (elapsed >= maxTime)
            break;
    }

    var bestChild = null;
    var bestScore = -Infinity;
    for (var i = 0; i < root.children.length; i++) {
        var child = root.children[i];
        if (child.visits > bestScore) {
            bestChild = child;
            bestScore = child.visits;
        }
    }

    var move = bestChild.move;
    var fromRow = move >> 24;
    var fromCol = (move >> 16) & 0xFF;
    var toRow = (move >> 8) & 0xFF;
    var toCol = (move) & 0xFF;

    return { elapsed: elapsed,
             playouts: TotalPlayouts,
             fromRow: fromRow,
             fromCol: fromCol,
             toRow: toRow,
             toCol: toCol
           };
}

