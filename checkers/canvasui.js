// vim: set ts=4 sw=4 tw=99 et:
// Copyright (C) 2010 David Anderson 
// dvander@alliedmods.net
//
// Canvas code is based on the tutorial at http://diveintohtml5.org/canvas.html
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

function CanvasCheckers(canvas, predictor, rows, cols)
{
    this.rows = rows;
    this.cols = cols;
    var computer = Checkers.PlayerTwo;

    // Initialize canvas variables.
    var PieceWidth = 50;
    var PieceHeight = 50;
    var BoardWidth = 1 + (cols * PieceWidth);
    var BoardHeight = 1 + (rows * PieceHeight);

    canvas.width = BoardWidth;
    canvas.height = BoardHeight;

    var DrawContext = canvas.getContext("2d");

    function Draw(b, selRow, selCol) {
        DrawContext.clearRect(0, 0, BoardWidth, BoardHeight);
        DrawContext.beginPath();

        // Vertical lines.
        for (var x = 0; x <= BoardWidth; x += PieceWidth) {
            DrawContext.moveTo(0.5 + x, 0);
            DrawContext.lineTo(0.5 + x, BoardHeight);
        }

        // Horizontal lines.
        for (var y = 0; y <= BoardHeight; y += PieceHeight) {
            DrawContext.moveTo(0, 0.5 + y);
            DrawContext.lineTo(BoardWidth, 0.5 + y);
        }

        // Draw!
        DrawContext.strokeStyle = "#ccc";
        DrawContext.stroke();

        // Now fill in every other square with a light gray.
        var odds = 1;
        for (var row = 0; row < rows; row++) {
            for (var col = 0; col < cols; col++) {
                if ((col & 1) != odds)
                    DrawContext.fillStyle = "#eeeeee";
                else
                    DrawContext.fillStyle = "#dddddd";
                DrawContext.fillRect(row * PieceHeight + 0.5,
                                     col * PieceWidth + 0.5,
                                     PieceHeight, PieceWidth);
            }
            odds = odds ^ 1;
        }

        function drawCircle(posX, posY, radius, lineWidth, color) {
            DrawContext.beginPath();
            DrawContext.lineWidth = lineWidth;
            DrawContext.arc(posX, posY, radius, 0, Math.PI * 2, false);
            DrawContext.closePath();
            DrawContext.strokeStyle = color;
            DrawContext.stroke();
        }

        // Now, fill in player pieces.
        var radius = (PieceWidth / 2) - (PieceWidth / 10);
        for (var row = 0; row < rows; row++) {
            for (var col = 0; col < cols; col++) {
                var piece = b.getPlayer(row, col);
                if (piece == Checkers.EmptyPlayer)
                    continue;

                var posX = (col * PieceWidth) + (PieceWidth / 2);
                var posY = (row * PieceHeight) + (PieceHeight / 2);

                var color = (piece == Checkers.PlayerOne)
                            ? "#ed1c24"
                            : "#00a2e8";
                drawCircle(posX, posY, radius, 4, color);
                if (b.isKing(row, col)) {
                    // Draw a more different S
                    drawCircle(posX, posY, radius - 4, 2, color);
                    drawCircle(posX, posY, radius - 8, 2, color);
                    drawCircle(posX, posY, radius - 12, 2, color);
                    drawCircle(posX, posY, radius - 16, 1, color);
                }

                if (selRow === row && selCol === col) {
                    DrawContext.fillStyle = color;
                    DrawContext.fill();
                }
            }
        }
    }

    var game;
    var selectedRow = undefined;
    var selectedCol = undefined;

    var computerPlay = function () {
        var moves = new Checkers.MoveList(game.board.area());
        game.board.fillMoveList(moves);

        var result;
        if (moves.length > 1) {
            predictor.innerHTML = 'thinking...';
            result = game.suggest(3000);
            var seconds = result.elapsed / 1000;
            var nPerSec = result.playouts / seconds;

            predictor.innerHTML = Math.floor(nPerSec) + "/sec";
        } else {
            move = moves.list[0];
            result = { }
            result.fromRow = move >> 24;
            result.fromCol = (move >> 16) & 0xFF;
            result.toRow = (move >> 8) & 0xFF;
            result.toCol = (move) & 0xFF;
        }

        var winner = game.move(result.fromRow, result.fromCol,
                               result.toRow, result.toCol);
        if (winner) {
            var color = winner == Checkers.PlayerOne
                        ? "Red"
                        : "Blue";
            alert(color + " player wins! Refresh to play again.");
            return;
        }

        Draw(game.board);
        if (game.inMultiTurn())
            setTimeout(computerPlay, 400);
    }

    var onClick = function (e) {
        var x, y;
        if (e.pageX != undefined && e.pageY != undefined) {
            x = e.pageX;
            y = e.pageY;
        } else {
            x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        x -= canvas.offsetLeft;
        y -= canvas.offsetTop;
        x = Math.min(x, cols * PieceWidth);
        y = Math.min(y, rows * PieceHeight);

        var row = Math.floor(y / PieceHeight);
        var col = Math.floor(x / PieceWidth);

        // Don't let the player move during the computer's turn.
        if (game.player() == computer)
            return;

        var player = game.playerAt(row, col);
        if (player) {
            if (player != game.player())
                return;

            // If the player is selecting an own piece, just update the display.
            if (!game.inMultiTurn()) {
                selectedRow = row;
                selectedCol = col;
                Draw(game.board, selectedRow, selectedCol);
                return;
            }
        }

        // If the player is selecting an empty square without having done
        // anything yet, just return.
        if (selectedRow === undefined)
            return;

        var fromRow = selectedRow;
        var fromCol = selectedCol;
        if (!game.inMultiTurn()) {
            selectedRow = undefined;
            selectedCol = undefined;
        }

        // Try to move. If it's not valid, redraw.
        try {
            var winner = game.move(fromRow, fromCol, row, col);
            if (winner) {
                var color = winner == Checkers.PlayerOne
                            ? "Red"
                            : "Blue";
                alert(color + " player wins! Refresh to play again.");
                return;
            }
        } catch (e) {
            alert('Invalid move: ' + e);
            Draw(game.board, selectedRow, selectedCol);
            return;
        }

        // The move was valid. If the player is allowed to move again,
        // re-select the piece and redraw.
        if (game.inMultiTurn()) {
            selectedRow = row;
            selectedCol = col;
            Draw(game.board, row, col);
            return;
        }

        Draw(game.board);

        // Otherwise, draw and let the computer make a move.
        if (computer)
            setTimeout(computerPlay, 400);
    }

    this.switchSides = function () {
        computer = computer ^ 1;
        setTimeout(computerPlay, 500);
    }

    this.start = function (game_) {
        game = game_;
        canvas.addEventListener("click",
            onClick,
            false);
        Draw(game.board);
    }
}

