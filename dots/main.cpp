// vim: set ts=8 sts=2 sw=2 tw=99 et: 
#include "board.h"
#include "uct.h"
#include <stdlib.h>
#include <string.h>

using namespace dts;

static inline bool
CharToRow(char row_char, unsigned *out)
{
  if (row_char >= 'A' && row_char <= 'Z') {
    *out = row_char - 'A';
    return true;
  }
  if (row_char >= 'a' && row_char <= 'z') {
    *out = row_char - 'a';
    return true;
  }
  return false;
}

static void
Draw(const Board *board)
{
  std::vector<Edge> edges = board->edges();
  std::vector<Point> rects = board->filled();

  printf("  ");
  for (unsigned col = 0; col < board->dot_cols(); col++) {
    printf("%d ", col);
  }
  printf("\n");

  for (unsigned row = 0; row < board->rows(); row++) {
    if (row & 1)
      printf("  ");
    else
      printf("%c ", 'A' + row / 2);
    for (unsigned col = 0; col < board->cols(); col++) {
      unsigned vertex = board->vertexOf(row, col);
      TileType tile = board->tile(vertex);
      switch (tile) {
       case Tile_Dot:
        printf(".");
        break;
       case Tile_HorizontalGap:
        if (board->lineAt(vertex))
          printf("-");
        else
          printf(" ");
        break;
       case Tile_VerticalGap:
        if (board->lineAt(vertex))
          printf("|");
        else
          printf(" ");
        break;
       case Tile_Space:
        printf(" ");
        break;
      }
    }
    printf("\n");
  }
  printf("(Player A: %d, Player B: %d)\n",
         board->score(Player_A),
         board->score(Player_B));
  printf("\n");
}

int main(int argc, char **argv)
{
  if (argc < 3) {
    fprintf(stderr, "Usage: <rows> <cols>\n");
    exit(1);
  }

  int rows = atoi(argv[1]);
  int cols = atoi(argv[2]);
  if (rows < 3 || cols < 3) {
    fprintf(stderr, "Minimum width and height is 3x3.\n");
    exit(1);
  }

  Board *board = Board::New(rows, cols);
  UCT uct(board, 10000000, 200);
  Player AI = Player_B;

  while (!board->game_over()) {
    Draw(board);

    unsigned vertex;
    while (true) {
      Point p1, p2;
      char buffer[32];
      char row_char1, row_char2;

      if (board->player() == Player_A)
        printf("Player A ");
      else
        printf("Player B ");
      printf("move: ");

      if (board->player() != AI) {
        if (fgets(buffer, sizeof(buffer), stdin) != buffer) {
          printf("Exiting.\n");
          exit(0);
        }
        if (sscanf(buffer, "%c%u%c%u", &row_char1, &p1.x, &row_char2, &p2.x) != 4) {
          printf("Invalid input.\n");
          continue;
        }

        if (!CharToRow(row_char1, &p1.y) || !CharToRow(row_char2, &p2.y)) {
          printf("Invalid row.");
          continue;
        }

        if (!board->edgeToVertex(p1, p2, &vertex)) {
          printf("Invalid line segment.\n");
          continue;
        }

        assert(board->isPlayable(vertex));
        if (board->isValidMove(vertex))
          break;

        printf("Invalid move.\n");
      } else {
        if (uct.run(&vertex)) {
          printf(" %d\n", vertex);
          break;
        }

        printf("UCT failed\n");
        exit(1);
      }
    }

    board->playAt(vertex);
  }

  Player winner = board->winner();
  if (winner == Player_None) {
    printf("Tie game! (%d-%d)\n", board->score(Player_A), board->score(Player_B));
  } else {
    printf("(Player A: %d, Player B: %d)\n",
           board->score(Player_A),
           board->score(Player_B));
  }
}

